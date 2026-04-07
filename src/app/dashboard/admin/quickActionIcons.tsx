import {
  Calendar,
  DollarSign,
  MessageSquare,
  PersonStanding,
  Briefcase,
  FileText,
  User,
  Activity,
  Heart,
  ShieldCheck,
  Phone,
  Mail,
  Clock,
  Award,
  type LucideIcon,
} from "lucide-react";

export const ICON_MAP: Record<string, LucideIcon> = {
  calendar: Calendar,
  dollar: DollarSign,
  message: MessageSquare,
  person: PersonStanding,
  briefcase: Briefcase,
  fileText: FileText,
  user: User,
  activity: Activity,
  heart: Heart,
  shield: ShieldCheck,
  phone: Phone,
  mail: Mail,
  clock: Clock,
  award: Award,
};

export const ICON_OPTIONS: { key: string; label: string }[] = [
  { key: "calendar", label: "Calendario" },
  { key: "dollar", label: "Dinero / Nómina" },
  { key: "message", label: "Mensaje" },
  { key: "person", label: "Persona" },
  { key: "briefcase", label: "Maletín" },
  { key: "fileText", label: "Documento" },
  { key: "user", label: "Usuario" },
  { key: "activity", label: "Actividad" },
  { key: "heart", label: "Bienestar" },
  { key: "shield", label: "Seguridad" },
  { key: "phone", label: "Teléfono" },
  { key: "mail", label: "Correo" },
  { key: "clock", label: "Reloj" },
  { key: "award", label: "Reconocimiento" },
];

export const getIcon = (key: string): LucideIcon =>
  ICON_MAP[key] || Calendar;
