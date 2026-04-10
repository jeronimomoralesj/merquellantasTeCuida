-- =============================================================================
-- Merque Bienestar - SQL Server Schema
-- Run this script against your SQL Server to create the database and tables
-- =============================================================================

CREATE DATABASE MerqueBienestar;
GO

USE MerqueBienestar;
GO

-- =============================================================================
-- USERS
-- =============================================================================
CREATE TABLE users (
    id              NVARCHAR(128)   NOT NULL PRIMARY KEY,  -- Microsoft OID (from Azure AD)
    cedula          NVARCHAR(20)    NOT NULL UNIQUE,
    email           NVARCHAR(255)   NOT NULL UNIQUE,       -- @merquellantas.com email
    nombre          NVARCHAR(255)   NOT NULL,
    posicion        NVARCHAR(255)   NULL,
    rol             NVARCHAR(20)    NOT NULL DEFAULT 'user', -- 'user' | 'admin'
    -- Extra fields (previously nested in Firestore "extra" object)
    departamento        NVARCHAR(255) NULL,   -- "Nombre Área Funcional" / "Dpto Donde Labora"
    eps                 NVARCHAR(255) NULL,
    banco               NVARCHAR(255) NULL,
    caja_compensacion   NVARCHAR(255) NULL,   -- "CAJA DE COMPENSACION"
    fondo_pensiones     NVARCHAR(255) NULL,   -- "FONDO DE PENSIONES"
    arl                 NVARCHAR(255) NULL,
    fecha_ingreso       DATE          NULL,   -- "Fecha Ingreso"
    fondo_cesantias     NVARCHAR(255) NULL,
    cargo_empleado      NVARCHAR(255) NULL,
    numero_cuenta       NVARCHAR(100) NULL,
    tipo_cuenta         NVARCHAR(50)  NULL,
    tipo_documento      NVARCHAR(50)  NULL,
    fecha_nacimiento    DATE          NULL,
    -- Mood tracking (from chat component)
    mood                NVARCHAR(50)  NULL,
    mood_updated_at     DATETIME2     NULL,
    -- Timestamps
    created_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE()
);

-- =============================================================================
-- SOLICITUDES (vacaciones, incapacidad, permiso)
-- =============================================================================
CREATE TABLE solicitudes (
    id                  INT             IDENTITY(1,1) PRIMARY KEY,
    user_id             NVARCHAR(128)   NOT NULL REFERENCES users(id),
    nombre              NVARCHAR(255)   NOT NULL,
    cedula              NVARCHAR(20)    NOT NULL,
    tipo                NVARCHAR(20)    NOT NULL,  -- 'vacaciones' | 'incapacidad' | 'permiso'
    estado              NVARCHAR(20)    NOT NULL DEFAULT 'pendiente', -- 'pendiente' | 'aprobado' | 'rechazado'
    description         NVARCHAR(MAX)   NULL,
    motivo_respuesta    NVARCHAR(MAX)   NULL,
    -- Vacaciones fields
    fecha_inicio        DATE            NULL,
    fecha_fin           DATE            NULL,
    dias_vacaciones     INT             NULL,
    -- Permiso fields
    fecha               DATE            NULL,
    tiempo_inicio       NVARCHAR(10)    NULL,
    tiempo_fin          NVARCHAR(10)    NULL,
    -- Incapacidad fields
    edad                NVARCHAR(10)    NULL,
    gender              NVARCHAR(20)    NULL,
    tipo_contrato       NVARCHAR(50)    NULL,
    ubicacion           NVARCHAR(100)   NULL,
    cargo               NVARCHAR(100)   NULL,
    tipo_evento         NVARCHAR(100)   NULL,
    cie10               NVARCHAR(20)    NULL,
    codigo_incap        NVARCHAR(50)    NULL,
    mes_diagnostico     NVARCHAR(50)    NULL,
    start_date          DATE            NULL,
    end_date            DATE            NULL,
    num_dias            INT             NULL,
    -- Document (stored in OneDrive)
    document_url        NVARCHAR(MAX)   NULL,
    document_name       NVARCHAR(500)   NULL,
    -- Timestamps
    created_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    updated_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE()
);

-- =============================================================================
-- CESANTIAS
-- =============================================================================
CREATE TABLE cesantias (
    id                  INT             IDENTITY(1,1) PRIMARY KEY,
    user_id             NVARCHAR(128)   NOT NULL REFERENCES users(id),
    nombre              NVARCHAR(255)   NOT NULL,
    cedula              NVARCHAR(20)    NOT NULL,
    motivo_solicitud    NVARCHAR(MAX)   NOT NULL,
    categoria           NVARCHAR(100)   NOT NULL,
    file_url            NVARCHAR(MAX)   NULL,
    estado              NVARCHAR(20)    NOT NULL DEFAULT 'pendiente',
    motivo_respuesta    NVARCHAR(MAX)   NULL,
    created_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
    updated_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE()
);

-- =============================================================================
-- PQRSF
-- =============================================================================
CREATE TABLE pqrsf (
    id                  INT             IDENTITY(1,1) PRIMARY KEY,
    user_id             NVARCHAR(128)   NOT NULL REFERENCES users(id),
    type                NVARCHAR(20)    NOT NULL,  -- 'Pregunta' | 'Queja' | 'Reclamo' | 'Sugerencia' | 'Felicitación'
    message             NVARCHAR(MAX)   NOT NULL,
    is_anonymous        BIT             NOT NULL DEFAULT 0,
    nombre              NVARCHAR(255)   NULL,
    cedula              NVARCHAR(20)    NULL,
    created_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE()
);

-- =============================================================================
-- CALENDAR (events + birthdays)
-- =============================================================================
CREATE TABLE calendar (
    id                  INT             IDENTITY(1,1) PRIMARY KEY,
    user_id             NVARCHAR(128)   NULL REFERENCES users(id),  -- NULL for general events
    type                NVARCHAR(20)    NOT NULL DEFAULT 'event',    -- 'birthday' | 'event'
    title               NVARCHAR(500)   NOT NULL,
    description         NVARCHAR(MAX)   NULL,
    image               NVARCHAR(MAX)   NULL,
    date                DATE            NOT NULL,
    video_url           NVARCHAR(MAX)   NULL,
    video_path          NVARCHAR(MAX)   NULL,
    created_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE()
);

-- =============================================================================
-- DOCUMENTOS (corporate document library)
-- =============================================================================
CREATE TABLE documentos (
    id                  INT             IDENTITY(1,1) PRIMARY KEY,
    name                NVARCHAR(500)   NOT NULL,
    category            NVARCHAR(100)   NOT NULL,
    document            NVARCHAR(MAX)   NOT NULL,  -- OneDrive URL
    size                NVARCHAR(50)    NULL,
    type                NVARCHAR(20)    NULL,       -- 'pdf' | 'excel' | 'word' | 'other'
    date_uploaded       DATETIME2       NOT NULL DEFAULT GETUTCDATE()
);

-- =============================================================================
-- QUICK ACTIONS
-- =============================================================================
CREATE TABLE quick_actions (
    id                  INT             IDENTITY(1,1) PRIMARY KEY,
    title               NVARCHAR(255)   NOT NULL,
    href                NVARCHAR(MAX)   NOT NULL,
    icon                NVARCHAR(50)    NOT NULL,
    [order]             INT             NOT NULL DEFAULT 0,
    active              BIT             NOT NULL DEFAULT 1
);

-- =============================================================================
-- INDEXES for common queries
-- =============================================================================
CREATE INDEX IX_solicitudes_user_id ON solicitudes(user_id);
CREATE INDEX IX_solicitudes_tipo ON solicitudes(tipo);
CREATE INDEX IX_solicitudes_estado ON solicitudes(estado);
CREATE INDEX IX_solicitudes_created_at ON solicitudes(created_at DESC);
CREATE INDEX IX_cesantias_user_id ON cesantias(user_id);
CREATE INDEX IX_cesantias_created_at ON cesantias(created_at DESC);
CREATE INDEX IX_pqrsf_created_at ON pqrsf(created_at DESC);
CREATE INDEX IX_calendar_date ON calendar(date ASC);
CREATE INDEX IX_calendar_type ON calendar(type);
CREATE INDEX IX_calendar_user_id ON calendar(user_id);
CREATE INDEX IX_users_cedula ON users(cedula);
CREATE INDEX IX_users_email ON users(email);

GO
