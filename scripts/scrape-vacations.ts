/**
 * Monthly scraper: pulls each user's "Días Pendientes Consolidado" from
 * Heinsohn NóminaWEB and upserts it into the `vacation_balances` collection.
 *
 * Usage (from project root):
 *   HEINSOHN_USER=nomina2@merquellantas.com \
 *   HEINSOHN_PASS=Colombia3 \
 *   npx tsx scripts/scrape-vacations.ts
 *
 *   # Debug (visible browser):
 *   HEADLESS=0 npx tsx scripts/scrape-vacations.ts
 *
 *   # Just one cedula:
 *   npx tsx scripts/scrape-vacations.ts --cedula=1016912012
 *
 * Reads MONGODB_URI from .env.local (via dotenv). Safe to run any day of the
 * month — it always uses the 1st of the current month as the fecha corte.
 */

import 'dotenv/config';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { MongoClient, ObjectId } from 'mongodb';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import AdmZip from 'adm-zip';
import * as XLSX from 'xlsx';

// Load .env.local too (Next.js default) if present
const envLocal = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal, override: false });

const BASE = process.env.HEINSOHN_BASE || 'https://nominasaas191.heinsohn.com.co/NominaWEB';
const USER = process.env.HEINSOHN_USER;
const PASS = process.env.HEINSOHN_PASS;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB || 'merque_bienestar';
const HEADLESS = process.env.HEADLESS !== '0';

if (!USER || !PASS) {
  console.error('HEINSOHN_USER and HEINSOHN_PASS must be set');
  process.exit(1);
}
if (!MONGODB_URI) {
  console.error('MONGODB_URI not set');
  process.exit(1);
}

// Escape a JSF id for use in a CSS selector (colons must be backslash-escaped)
const sel = (id: string) => `#${id.replace(/:/g, '\\:')}`;

// DD/MM/YYYY for the 1st of the current month
function firstOfMonthLabel(d = new Date()): { label: string; iso: string } {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return { label: `01/${mm}/${yyyy}`, iso: `${yyyy}-${mm}-01` };
}

async function login(page: Page) {
  console.log('Logging in...');
  // Heinsohn moved the login page — /login.seam now 404s. The index redirects us
  // to the real form at /common/mainPages/login.seam, so start from BASE + "/".
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });

  // Current form inputs: login:username, login:password, login:loginId (submit).
  // Keep a few fallbacks in case Heinsohn renames them again.
  const userSelectors = [
    'input[name="login:username"]',
    'input[id="login:username"]',
    'input[name*="usuario" i]',
    'input[type="email"]',
    'input[type="text"]:not([type="hidden"])',
  ];
  const passSelectors = [
    'input[name="login:password"]',
    'input[id="login:password"]',
    'input[type="password"]',
  ];
  const submitSelectors = [
    'input[name="login:loginId"]',
    'input[id="login:loginId"]',
    'input[type="submit"]',
    'button[type="submit"]',
  ];

  const firstAvailable = async (selectors: string[]): Promise<string | null> => {
    for (const s of selectors) {
      const el = await page.$(s);
      if (el) return s;
    }
    return null;
  };

  const userSel = await firstAvailable(userSelectors);
  const passSel = await firstAvailable(passSelectors);
  const submitSel = await firstAvailable(submitSelectors);
  if (!userSel || !passSel || !submitSel) {
    throw new Error(`Could not locate login form (user=${userSel}, pass=${passSel}, submit=${submitSel})`);
  }

  await page.fill(userSel, USER!);
  await page.fill(passSel, PASS!);
  await Promise.all([
    page.waitForLoadState('networkidle'),
    page.click(submitSel),
  ]);

  // Confirm we're logged in by looking for the company header
  await page.waitForSelector('#nombrecompania_navbar, h3.nombcompania', { timeout: 20_000 });
  console.log('Logged in.');
}

async function scrapeOne(
  ctx: BrowserContext,
  page: Page,
  cedula: string,
  fechaLabel: string
): Promise<number> {
  // Go fresh to the report form every time so the employee filter is empty.
  await page.goto(`${BASE}/vacaciones/generar_reporte_listado_vacaciones.seam`, {
    waitUntil: 'domcontentloaded',
  });

  // The form's id varies (`formListVaca:empleadoDecorate:j_id178`). Target by
  // class name and "empleadoDecorate" attribute fragment instead.
  await page.waitForSelector('input.boton_seleccionar[id*="empleadoDecorate"]');
  await page.click('input.boton_seleccionar[id*="empleadoDecorate"]');

  // Modal: "Número Identificación" input
  const cedulaInput = sel('formSeleccionarEmpleadoselEmp:numeroDocumentoDecselEmp:numeroDocumentoselEmp');
  await page.waitForSelector(cedulaInput, { timeout: 15_000, state: 'visible' });

  // Fill + commit + Consultar, then verify the table is actually filtered down
  // to rows matching our cedula. Without the commit step (change + Tab), the
  // Consultar click races Playwright's fill and Heinsohn submits an empty
  // cedula filter — returning the FULL employee list. In that state the
  // row-level checkbox click does not translate to a server-side selection,
  // and the subsequent "Actualizar" closes the modal without populating the
  // main form, which is what produced the "waitForFunction timeout" errors.
  //
  // States we have to distinguish after Consultar:
  //   1. filter applied, 1+ rows all containing our cedula   → ready
  //   2. filter applied, 0 rows (table gone/empty)           → not in Heinsohn,
  //      fail fast (retrying won't help)
  //   3. filter NOT applied, unfiltered employee list        → race, retry
  type SearchState = 'ready' | 'not-found' | 'unfiltered' | 'pending';
  const readState = async (): Promise<SearchState> => {
    return page.evaluate((wantedCedula: string) => {
      const inp = document.querySelector(
        '#formSeleccionarEmpleadoselEmp\\:numeroDocumentoDecselEmp\\:numeroDocumentoselEmp',
      ) as HTMLInputElement | null;
      const filterStuck = !!inp && inp.value.trim() === wantedCedula;
      const table = document.querySelector(
        'table[id*="tablaEmpleadosselEmp"]',
      ) as HTMLTableElement | null;
      const rows = table
        ? Array.from(table.querySelectorAll('tr.rich-table-firstrow, tr.rich-table-row'))
        : [];
      if (rows.length === 0) return filterStuck ? 'not-found' : 'pending';
      const allMatch = rows.every((r) =>
        (((r as HTMLElement).innerText || r.textContent) ?? '')
          .replace(/\s+/g, ' ')
          .includes(wantedCedula),
      );
      if (allMatch) return 'ready';
      return 'unfiltered';
    }, cedula) as Promise<SearchState>;
  };

  let finalState: SearchState = 'pending';
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.fill(cedulaInput, '');
    await page.fill(cedulaInput, cedula);
    await page.dispatchEvent(cedulaInput, 'change');
    await page.press(cedulaInput, 'Tab');

    await page.click(sel('formSeleccionarEmpleadoselEmp:btnBuscarselEmp'));

    // Give the AJAX a moment to settle; then poll until we get a terminal
    // state (ready / not-found) or until we confirm it's unfiltered.
    let state: SearchState = 'pending';
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      await page.waitForTimeout(400);
      state = await readState();
      if (state === 'ready' || state === 'not-found' || state === 'unfiltered') break;
    }
    finalState = state;
    if (state === 'ready' || state === 'not-found') break;
    // 'unfiltered' or 'pending' → retry the search
  }
  if (finalState === 'not-found') {
    throw new Error(`Cédula ${cedula} no encontrada en Heinsohn`);
  }
  if (finalState !== 'ready') {
    throw new Error(`Heinsohn no devolvió resultados filtrados para ${cedula}`);
  }

  // Click the checkbox inside the ACTUAL data row. Important constraints:
  //   - restrict to tr.rich-table-firstrow / rich-table-row (data rows only);
  //     otherwise `tr:has-text()` also matches the <tr> containing the header
  //     "Seleccionar Todos" checkbox, which is invisible → Playwright spins.
  //   - the row sometimes hosts its own checkbox plus a grouper checkbox, so
  //     explicitly exclude anything with title containing "Todos".
  //   - do the dispatch in-page so RichFaces sees the synchronous click and
  //     doesn't swap the handle out from under us mid-attempt.
  const clicked = await page.evaluate((wantedCedula) => {
    const table = document.querySelector(
      'table[id*="tablaEmpleadosselEmp"]',
    ) as HTMLTableElement | null;
    if (!table) return false;
    const rows = Array.from(
      table.querySelectorAll('tr.rich-table-firstrow, tr.rich-table-row'),
    );
    for (const r of rows) {
      const text = ((r as HTMLElement).innerText || r.textContent || '')
        .replace(/\s+/g, ' ');
      if (!text.includes(wantedCedula)) continue;
      const cb = Array.from(
        r.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      ).find((el) => !(el.title || '').toLowerCase().includes('todos'));
      if (cb) {
        cb.click();
        return true;
      }
    }
    return false;
  }, cedula);
  if (!clicked) {
    throw new Error(`No se pudo marcar el checkbox para ${cedula}`);
  }

  // Click "Actualizar" to bring the selection back to the main form
  await page.click(sel('formSeleccionarEmpleadoselEmp:btnActualizarselEmp'));

  // Wait until the main form's employee input has a value. Pass `null` as the
  // second (arg) slot explicitly — otherwise Playwright treats the options
  // object as the pageFunction arg and silently falls back to its default 30s
  // timeout, which hides DOM-race errors as generic timeouts.
  await page.waitForFunction(
    () => {
      const el = document.querySelector(
        '#formListVaca\\:empleadoDecorate\\:empleadoSeleccionadaFiltro'
      ) as HTMLInputElement | null;
      return !!el && !!el.value && el.value.trim().length > 0;
    },
    null,
    { timeout: 30_000 }
  );

  // Set fecha corte (DD/MM/YYYY) — the RichFaces input also wants blur/change
  const dateSel = sel('formListVaca:fechaCorte:fechaInputDate');
  await page.fill(dateSel, fechaLabel);
  await page.dispatchEvent(dateSel, 'change');
  await page.press(dateSel, 'Tab');

  // Click "Generar" and capture the ZIP download
  const downloadPromise = page.waitForEvent('download', { timeout: 90_000 });
  await page.click('input[type="submit"][value="Generar"]');
  const dl = await downloadPromise;

  const tmpPath = await dl.path();
  if (!tmpPath) throw new Error('No se pudo obtener la ruta de descarga');
  const zipBuf = fs.readFileSync(tmpPath);
  const zip = new AdmZip(zipBuf);
  const xlsxEntry = zip.getEntries().find((e) => /\.xlsx$/i.test(e.entryName));
  if (!xlsxEntry) throw new Error('El ZIP no contiene un archivo .xlsx');

  const wb = XLSX.read(xlsxEntry.getData(), { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });

  // Walk rows from bottom up; the last employee-data row has the cedula in
  // column B and the "Días Pendientes Consolidado" number in column C.
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i] as unknown[];
    if (!row || row.length < 3) continue;
    const rowCedula = String(row[1] ?? '').trim();
    const dias = row[2];
    if (rowCedula === cedula && typeof dias === 'number' && !Number.isNaN(dias)) {
      return Number(dias);
    }
  }

  throw new Error('No se encontraron días en el XLSX');
}

async function main() {
  const argv = process.argv.slice(2);
  const cedulaArg = argv.find((a) => a.startsWith('--cedula='))?.split('=')[1];
  const limitArg = argv.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? Number(limitArg) : undefined;
  // Accept --cedula=X,Y,Z so retry runs can hit many cedulas under one login.
  const cedulaList = cedulaArg
    ? cedulaArg.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const { label: fechaLabel, iso: asOfDate } = firstOfMonthLabel();
  console.log(`Fecha Corte: ${fechaLabel} (as_of=${asOfDate})`);

  const client = await new MongoClient(MONGODB_URI!).connect();
  const db = client.db(DB_NAME);
  const usersCol = db.collection('users');
  const balancesCol = db.collection('vacation_balances');

  const filter: Record<string, unknown> = {};
  if (cedulaList.length === 1) filter.cedula = cedulaList[0];
  else if (cedulaList.length > 1) filter.cedula = { $in: cedulaList };

  let targets = await usersCol
    .find(filter, { projection: { _id: 1, cedula: 1, nombre: 1, rol: 1 } })
    .toArray();
  targets = targets.filter((u) => u.cedula && String(u.cedula).length > 0);
  if (limit) targets = targets.slice(0, limit);
  console.log(`Found ${targets.length} users to scrape.`);

  let browser: Browser | null = null;
  const errors: { cedula: string; nombre: string; error: string }[] = [];
  let okCount = 0;

  try {
    browser = await chromium.launch({ headless: HEADLESS });
    const ctx = await browser.newContext({ acceptDownloads: true });
    const page = await ctx.newPage();
    await login(page);

    for (let i = 0; i < targets.length; i++) {
      const u = targets[i];
      const cedula = String(u.cedula);
      const nombre = String(u.nombre || '');
      const label = `${i + 1}/${targets.length}  ${cedula}  ${nombre}`;

      try {
        const days = await scrapeOne(ctx, page, cedula, fechaLabel);
        await balancesCol.updateOne(
          { cedula },
          {
            $set: {
              user_id: u._id.toString(),
              nombre,
              days,
              as_of_date: asOfDate,
              fecha_corte_label: fechaLabel,
              scraped_at: new Date(),
              source: 'scraper',
            },
            $setOnInsert: { created_at: new Date() },
          },
          { upsert: true }
        );
        okCount++;
        console.log(`✓ ${label}: ${days} días`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ cedula, nombre, error: message });
        console.error(`✗ ${label}: ${message}`);
      }
    }
  } finally {
    if (browser) await browser.close();
    await client.close();
  }

  console.log(`\nDONE. ok=${okCount}  errors=${errors.length}  total=${targets.length}`);
  if (errors.length) {
    console.log('\nErrors:');
    for (const e of errors) console.log(`  ${e.cedula} ${e.nombre}: ${e.error}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
