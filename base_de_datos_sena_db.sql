--
-- PostgreSQL database dump
--

\restrict Omk1M0t7cR09lcTIgCGwIW1BTWLJ9xPpeonSJdSrdXM95cvEIJXSZ4HnlEOksM3

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    organization_id integer,
    trd_series_id integer,
    trd_subseries_id integer,
    expediente_id integer,
    filename text,
    path text,
    typology_name text,
    document_date timestamp without time zone,
    status text DEFAULT 'Pendiente'::text,
    ades_id text,
    load_date timestamp without time zone,
    metadata_values text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    origen character varying(50) DEFAULT 'DIGITALIZADO'::character varying,
    storage_path text
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.documents_id_seq OWNER TO postgres;

--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: expedientes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expedientes (
    id integer NOT NULL,
    expediente_code text,
    box_id text,
    opening_date timestamp without time zone,
    subserie text,
    regional text,
    centro text,
    dependencia text,
    storage_type text,
    title text,
    metadata_values text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.expedientes OWNER TO postgres;

--
-- Name: expedientes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.expedientes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expedientes_id_seq OWNER TO postgres;

--
-- Name: expedientes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.expedientes_id_seq OWNED BY public.expedientes.id;


--
-- Name: organization_structure; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organization_structure (
    id integer NOT NULL,
    entity_name text DEFAULT 'SENA'::text,
    regional_code text,
    regional_name text,
    center_code text,
    center_name text,
    section_code text,
    section_name text,
    subsection_code text,
    subsection_name text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    storage_path text
);


ALTER TABLE public.organization_structure OWNER TO postgres;

--
-- Name: organization_structure_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organization_structure_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.organization_structure_id_seq OWNER TO postgres;

--
-- Name: organization_structure_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organization_structure_id_seq OWNED BY public.organization_structure.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role_name text NOT NULL,
    module_id text NOT NULL,
    can_view integer DEFAULT 1
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.role_permissions_id_seq OWNER TO postgres;

--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    key text NOT NULL,
    value text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_settings_id_seq OWNER TO postgres;

--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: trd_series; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trd_series (
    id integer NOT NULL,
    dependency_id integer,
    series_code text,
    series_name text,
    folder_hierarchy text,
    metadata_labels text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.trd_series OWNER TO postgres;

--
-- Name: trd_series_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trd_series_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trd_series_id_seq OWNER TO postgres;

--
-- Name: trd_series_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trd_series_id_seq OWNED BY public.trd_series.id;


--
-- Name: trd_subseries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trd_subseries (
    id integer NOT NULL,
    series_id integer,
    subseries_code text,
    subseries_name text,
    folder_hierarchy text,
    metadata_labels text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.trd_subseries OWNER TO postgres;

--
-- Name: trd_subseries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trd_subseries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trd_subseries_id_seq OWNER TO postgres;

--
-- Name: trd_subseries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trd_subseries_id_seq OWNED BY public.trd_subseries.id;


--
-- Name: trd_typologies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trd_typologies (
    id integer NOT NULL,
    series_id integer,
    subseries_id integer,
    typology_name text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.trd_typologies OWNER TO postgres;

--
-- Name: trd_typologies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.trd_typologies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trd_typologies_id_seq OWNER TO postgres;

--
-- Name: trd_typologies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.trd_typologies_id_seq OWNED BY public.trd_typologies.id;


--
-- Name: user_trd_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_trd_permissions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    series_id integer,
    subseries_id integer,
    can_view integer DEFAULT 1,
    can_upload integer DEFAULT 1
);


ALTER TABLE public.user_trd_permissions OWNER TO postgres;

--
-- Name: user_trd_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_trd_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_trd_permissions_id_seq OWNER TO postgres;

--
-- Name: user_trd_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_trd_permissions_id_seq OWNED BY public.user_trd_permissions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    full_name text NOT NULL,
    area text,
    "position" text,
    document_no text NOT NULL,
    password_hash text NOT NULL,
    email text,
    role text DEFAULT 'user'::text,
    organization_id integer,
    is_active integer DEFAULT 1,
    must_change_password integer DEFAULT 0
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: expedientes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expedientes ALTER COLUMN id SET DEFAULT nextval('public.expedientes_id_seq'::regclass);


--
-- Name: organization_structure id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_structure ALTER COLUMN id SET DEFAULT nextval('public.organization_structure_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: trd_series id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trd_series ALTER COLUMN id SET DEFAULT nextval('public.trd_series_id_seq'::regclass);


--
-- Name: trd_subseries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trd_subseries ALTER COLUMN id SET DEFAULT nextval('public.trd_subseries_id_seq'::regclass);


--
-- Name: trd_typologies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trd_typologies ALTER COLUMN id SET DEFAULT nextval('public.trd_typologies_id_seq'::regclass);


--
-- Name: user_trd_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_trd_permissions ALTER COLUMN id SET DEFAULT nextval('public.user_trd_permissions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.documents (id, organization_id, trd_series_id, trd_subseries_id, expediente_id, filename, path, typology_name, document_date, status, ades_id, load_date, metadata_values, created_at, origen, storage_path) FROM stdin;
7	\N	\N	\N	1742	DERECHO DE PETICION.pdf	C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI\\68\\9224\\DEP SERIE SUBSERIE\\ANONIMO\\NO INDICADO\\DERECHO DE PETICION.pdf	DERECHO DE PETICION	2025-01-21 01:53:00	Cargado	AES-885988	2026-03-08 14:51:10.855	\N	2026-03-05 20:53:38.987107	ELECTRONICO	\N
8	\N	\N	\N	1844	PRUEBA_ROBOT.pdf	C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI\\PRUEBA_ROBOT.pdf	DERECHO DE PETICION	2026-03-06 07:11:38.696	Cargado	AES-813345	2026-03-09 01:30:28.427	Pendiente	2026-03-06 07:11:38.696	DIGITALIZADO	\N
10	\N	\N	\N	1759	RESPUESTA A DERECHO DE PETICION.pdf	C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI\\68\\9224\\DEP SERIE SUBSERIE\\NINI JOHANNA CAICEDO CAICEDO\\NO INDICADO\\RESPUESTA A DERECHO DE PETICION.pdf	RESPUESTA A DERECHO DE PETICION	2025-01-17 15:46:00	Cargado	AES-104673	2026-03-08 16:17:14.378	\N	2026-03-08 10:47:22.404512	ELECTRONICO	\N
11	\N	\N	\N	1759	NINI JOHANNA CAICEDO CAICEDO. NO INDICADO 00 72025002358.pdf	C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI\\68\\9224\\DEP SERIE SUBSERIE\\NINI JOHANNA CAICEDO CAICEDO\\NO INDICADO\\NINI JOHANNA CAICEDO CAICEDO. NO INDICADO 00 72025002358.pdf	DERECHO DE PETICION	2025-01-05 00:00:00	Cargado	AES-642977	2026-03-10 15:25:25.949	\N	2026-03-08 10:47:22.680093	\N	\N
9	\N	\N	\N	1721	PRUEBA_ROBOT.pdf	C:\\Users\\Usuario\\Documents\\PRUEBA.pdf	DERECHO DE PETICION	2026-03-05 21:29:42.407055	Cargado	\N	2026-03-10 15:48:10.647	\N	2026-03-05 21:29:42.407055	DIGITALIZADO	\N
\.


--
-- Data for Name: expedientes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expedientes (id, expediente_code, box_id, opening_date, subserie, regional, centro, dependencia, storage_type, title, metadata_values, created_at) FROM stdin;
1844	2025EX-035881	\N	\N	68.9224-27	68	9224	DEP	\N	EXPEDIENTE DE PRUEBA ROBOT	\N	2026-03-05 21:11:38.652861
1759	2025EX-035882		2025-01-21 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"NINI JOHANNA CAICEDO CAICEDO.","valor2":"NO INDICADO","valor3":"00","valor4":"72025002358","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.772841
1742	2025EX-035881		2025-01-21 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025002225","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.761492
1721	2025EX-035884		2025-01-21 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025002816","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.743473
1725	2025EX-035887		2025-01-22 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"DIEGO CASTAÑEDA","valor2":"NO INDICADO","valor3":"00","valor4":"72025003821","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.746325
1750	2025EX-036150		2025-06-16 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"GRUPO EMPRESARIAL AGROSOLAR DC","valor2":"NO INDICADO","valor3":"00","valor4":"72025210524","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.768574
1753	2025EX-036153		2025-06-17 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"LINA MARCELA CADAVID","valor2":"NO INDICADO","valor3":"00","valor4":"72025204543","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.770305
1754	2025EX-036154		2025-06-17 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JESUS ENRIQUE PULIDO MALDONADO","valor2":"NO INDICADO","valor3":"00","valor4":"72025213161","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.770804
1760	2025EX-036159		2025-06-20 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025219936","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.773733
1764	2025EX-036163		2025-06-25 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"WILSON DAVID MUÑOZ MARTINEZ","valor2":"NO INDICADO","valor3":"00","valor4":"72025213899","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.775544
1768	2025EX-036167		2025-06-27 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"NALLARY YISETH CABALLERO GUERRERO","valor2":"NO INDICADO","valor3":"00","valor4":"72025216368","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.777315
1772	2025EX-036171		2025-07-01 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"TEAM EXPERTS FOR EUROPE","valor2":"NO INDICADO","valor3":"00","valor4":"72025218988","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.779161
1776	2025EX-036175		2025-07-02 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025221680","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.780842
1780	2025EX-036179		2025-07-02 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025230864","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.782559
1784	2025EX-036183		2025-07-03 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JUZGADO 06 PENAL CIRCUITO CONOCIMIENTO - SANTANDER","valor2":"NO INDICADO","valor3":"00","valor4":"72025246053","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.78452
1788	2025EX-036187		2025-07-04 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JOHANA ABUCHAIBE VELASQUEZ","valor2":"NO INDICADO","valor3":"00","valor4":"72025225580","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.786443
1792	2025EX-036191		2025-07-07 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"CRISTIAN RAUL RAMIREZ PEREIRA","valor2":"NO INDICADO","valor3":"00","valor4":"72025226940","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.788338
1797	2025EX-036196		2025-07-07 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JUZGADO 03 FAMILIA CIRCUITO - SANTANDER - BUCARAMANGA","valor2":"NO INDICADO","valor3":"00","valor4":"72025250037","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.791171
1803	2025EX-036202		2025-07-09 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JULY ALEXANDRA LEÓN PÉREZ","valor2":"NO INDICADO","valor3":"00","valor4":"72025238785","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.794134
1809	2025EX-036208		2025-07-11 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ALEX M. B. M","valor2":"NO INDICADO","valor3":"00","valor4":"72025232569","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.796948
1815	2025EX-036214		2025-07-14 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025235301","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.799717
1821	2025EX-036220		2025-07-17 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"MILLER YANPIER CARREÑO AVENDAÑO","valor2":"NO INDICADO","valor3":"00","valor4":"72025239468","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.802426
1827	2025EX-036226		2025-07-18 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025242466","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.805272
1833	2025EX-036232		2025-07-23 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"HENRY LEAL MARTIN","valor2":"NO INDICADO","valor3":"00","valor4":"72025247918","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.807787
1839	2025EX-036238		2025-07-29 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JUAN ESTEBAN RODRÍGUEZ GUERRA","valor2":"NO INDICADO","valor3":"00","valor4":"72025256717","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.810708
1755	2025EX-036155		2025-06-18 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025204325","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.77134
1762	2025EX-036161		2025-06-24 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"PAULA GARCIA","valor2":"NO INDICADO","valor3":"00","valor4":"72025221228","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.774734
1766	2025EX-036165		2025-06-26 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025214659","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.776424
1770	2025EX-036169		2025-06-27 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"MARÍA FERNANDA OLIVEROS HIGUERA","valor2":"NO INDICADO","valor3":"00","valor4":"72025217588","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.778336
1774	2025EX-036173		2025-07-02 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025219590","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.780001
1778	2025EX-036177		2025-07-02 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"IVÁN LEONARDO BARRERA VARGAS","valor2":"NO INDICADO","valor3":"00","valor4":"72025229988","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.781729
1783	2025EX-036182		2025-07-03 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025223320","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.783751
1787	2025EX-036186		2025-07-04 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025224854","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.785924
1791	2025EX-036190		2025-07-04 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"PROGRESSA","valor2":"NO INDICADO","valor3":"00","valor4":"72025232994","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.78776
1798	2025EX-036197		2025-07-08 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"DANA SOFIA ROJAS VILLALBA","valor2":"NO INDICADO","valor3":"00","valor4":"72025227616","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.791659
1804	2025EX-036203		2025-07-09 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"TEAM EXPERTS FOR EUROPE","valor2":"NO INDICADO","valor3":"00","valor4":"72025257257","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.794611
1810	2025EX-036209		2025-07-11 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JORGE RUBIO","valor2":"NO INDICADO","valor3":"00","valor4":"72025233367","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.797411
1816	2025EX-036215		2025-07-14 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025243092","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.800156
1822	2025EX-036221		2025-07-17 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025249552","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.802871
1828	2025EX-036227		2025-07-21 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ALEX MOISÉS BOLAÑO MIRANDA","valor2":"NO INDICADO","valor3":"00","valor4":"72025244139","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.805695
1834	2025EX-036233		2025-07-23 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"LEANDRO GIRALDO TORRES","valor2":"NO INDICADO","valor3":"00","valor4":"72025247950","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.808261
1757	2025EX-036157		2025-06-20 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"LINDA ALEJANDRA BUENO ARROYO","valor2":"NO INDICADO","valor3":"00","valor4":"72025209482","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.772261
1761	2025EX-036160		2025-06-24 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"RENE DIAZ ZABALA","valor2":"NO INDICADO","valor3":"00","valor4":"72025210269","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.774226
1765	2025EX-036164		2025-06-25 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025222272","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.775977
1769	2025EX-036168		2025-06-27 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025216782","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.777832
1773	2025EX-036172		2025-07-02 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025219570","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.779581
1777	2025EX-036176		2025-07-02 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025229537","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.781312
1781	2025EX-036180		2025-07-03 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"YASARI ADRIANA GALVIS LUZARDO","valor2":"NO INDICADO","valor3":"00","valor4":"72025221917","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.782962
1785	2025EX-036184		2025-07-04 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"SOFÍA DEL MAR PASCUAS OSORIO","valor2":"NO INDICADO","valor3":"00","valor4":"72025195615","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.785038
1790	2025EX-036189		2025-07-04 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"NATHALIA LAGUADO","valor2":"NO INDICADO","valor3":"00","valor4":"72025232910","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.787318
1744	2025EX-035888		2025-01-23 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025004558","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.76229
1795	2025EX-036194		2025-07-07 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025227187","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.790194
1796	2025EX-036195		2025-07-07 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"NATHALIA LAGUADO","valor2":"NO INDICADO","valor3":"00","valor4":"72025234244","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.790685
1799	2025EX-036198		2025-07-08 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"CARLOS SANCHEZ","valor2":"NO INDICADO","valor3":"00","valor4":"72025228055","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.792137
1801	2025EX-036200		2025-07-08 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025235577","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.793031
1802	2025EX-036201		2025-07-08 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025235628","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.793485
1806	2025EX-036205		2025-07-10 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"IVÁN LEONARDO BARRERA VARGAS","valor2":"NO INDICADO","valor3":"00","valor4":"72025239520","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.795611
1807	2025EX-036206		2025-07-10 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025239995","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.796104
1808	2025EX-036207		2025-07-11 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JORGE RUBIO","valor2":"NO INDICADO","valor3":"00","valor4":"72025232113","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.796554
1812	2025EX-036211		2025-07-11 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025242592","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.79828
1813	2025EX-036212		2025-07-14 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JONATHAN FLÓREZ","valor2":"NO INDICADO","valor3":"00","valor4":"72025233789","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.798724
1814	2025EX-036213		2025-07-14 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"IVAN LEONARDO BARRERA VARGAS","valor2":"NO INDICADO","valor3":"00","valor4":"72025233854","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.799203
1818	2025EX-036217		2025-07-15 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025245411","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.801108
1819	2025EX-036218		2025-07-15 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025246113","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.801557
1820	2025EX-036219		2025-07-16 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025239251","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.802121
1824	2025EX-036223		2025-07-18 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025240143","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.803771
1825	2025EX-036224		2025-07-18 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"JEKSON ANDRÉS GAVANZO DÍAZ","valor2":"NO INDICADO","valor3":"00","valor4":"72025241784","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.804266
1826	2025EX-036225		2025-07-18 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ELIZABETH PEREIRA MORENO","valor2":"NO INDICADO","valor3":"00","valor4":"72025242217","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.804738
1830	2025EX-036229		2025-07-22 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"TEAM EXPERTS FOR EUROPE","valor2":"NO INDICADO","valor3":"00","valor4":"72025219002","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.806536
1831	2025EX-036230		2025-07-22 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025246151","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.806968
1832	2025EX-036231		2025-07-22 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025255934","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.807344
1836	2025EX-036235		2025-07-25 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025252357","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.809193
1837	2025EX-036236		2025-07-28 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANGELIE SARAY RICO MARÍN","valor2":"NO INDICADO","valor3":"00","valor4":"72025254466","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.809643
1838	2025EX-036237		2025-07-29 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025256407","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.810238
1840	2025EX-035885		2025-01-22 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025002863","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.811304
1841	2025EX-035883		2025-01-21 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025002461","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.815954
1842	2025EX-035889		2025-01-24 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025000227","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.82121
1843	2025EX-035886		2025-01-22 00:00:00	68.9224-27	\N	\N	\N	ELECTRÓNICO		{"valor1":"ANONIMO","valor2":"NO INDICADO","valor3":"00","valor4":"72025003555","valor5":"","valor6":"","valor7":"","valor8":""}	2026-03-05 20:52:37.822754
\.


--
-- Data for Name: organization_structure; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organization_structure (id, entity_name, regional_code, regional_name, center_code, center_name, section_code, section_name, subsection_code, subsection_name, created_at, storage_path) FROM stdin;
6	SENA	68	REGIONAL SANTANDER	9224	CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL	9224	SUBDIRECCION DE CENTROS DE FORMACION PROFESIONAL			2026-03-05 19:36:16.94955	C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI
7	SENA	68	REGIONAL SANTANDER	9224	CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL	9224	SUBDIRECCION DE CENTROS DE FORMACION PROFESIONAL	9224.2	GRUPO ADMINISTRACION EDUCATIVA	2026-03-05 19:38:47.966779	C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI
8	SENA	68	REGIONAL SANTANDER	9224	CENTRO INDUSTRIAL DE MANTENIMIENTO INTEGRAL	9224	SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL	9224.4	GRUPO DE FORMACION PROFESIONAL INTEGRAL, GESTION EDUCATIVA Y RELACIONES CORPORATIVAS	2026-03-05 20:36:14.975355	C:\\Users\\Usuario\\OneDrive - Servicio Nacional de Aprendizaje\\CIMI
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (id, role_name, module_id, can_view) FROM stdin;
126	admin	dashboard	1
127	admin	trd	1
128	admin	expedientes	1
129	admin	documents	1
130	admin	query	1
131	admin	mass-upload	1
132	admin	cargue-aes	1
133	admin	letters	1
134	admin	onedrive	1
135	admin	config-aes	1
136	admin	automation	1
137	admin	users	1
138	admin	permissions	1
139	user	dashboard	1
144	user	mass-upload	0
147	user	onedrive	0
148	user	config-aes	0
149	user	automation	0
150	user	users	0
151	user	permissions	0
140	user	trd	0
141	user	expedientes	0
146	user	letters	0
145	user	cargue-aes	0
142	user	documents	1
143	user	query	1
160	user	trd_query	1
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings (id, key, value, updated_at) FROM stdin;
3	onbase_url	https://onbase.sena.edu.co/Onbase/Login.aspx	2026-02-22 04:18:59
4	onbase_user	JRROZO	2026-02-22 04:18:59
5	onbase_pass	Sena2025**	2026-02-22 04:18:59
12	ades_url	https://onbase.sena.edu.co/Onbase/Login.aspx	2026-03-10 10:45:23.428916
13	ades_username	JRROZO	2026-03-10 10:45:23.43948
14	ades_password	Sena2025**	2026-03-10 10:45:23.452833
15	system_expiration_date	2027-01-08	2026-02-25 18:51:20.116689
7	storage_path	C:\\Users\\Propietario\\OneDrive - Servicio Nacional de Aprendizaje\\Documents\\CIMI	2026-03-25 15:15:06.517632
6	folder_hierarchy	[{"type":"dep","label":"Dependencia"},{"type":"ser","label":"Serie"},{"type":"meta_4","label":"Radicado (Valor 4)"},{"type":"typology","label":"Tipología Documental"}]	2026-02-22 15:48:28
\.


--
-- Data for Name: trd_series; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trd_series (id, dependency_id, series_code, series_name, folder_hierarchy, metadata_labels, created_at) FROM stdin;
83	6	68.9224-02	ACTAS	\N	\N	2026-03-05 20:36:31.42566
84	6	68.9224-03	ACTOS ADMINISTRATIVOS	\N	\N	2026-03-05 20:36:31.491325
85	6	68.9224-22	CONTRATOS	\N	\N	2026-03-05 20:36:31.496706
87	6	68.9224-42	INFORMES	\N	\N	2026-03-05 20:36:34.103577
92	8	68.9224.4-02	ACTAS	\N	\N	2026-03-05 20:50:55.015454
94	8	68.9224.4-42	INFORMES	\N	\N	2026-03-05 20:50:55.095958
96	8	68.9224.4-81	PROCESOS DE VENTA DE PRODUCTOS	\N	\N	2026-03-05 20:50:55.13849
98	8	68.9224.4-85	PROGRAMAS	\N	\N	2026-03-05 20:50:55.235095
99	8	68.9224.4-53	PLANES	\N	\N	2026-03-05 20:50:55.276796
100	8	68.9224.4-86	PROGRAMAS DE APOYOS DE SOSTENIMIENTO	\N	\N	2026-03-05 20:50:55.473006
104	8	68.9224.4-87	PROYECTOS	\N	\N	2026-03-05 20:50:55.597373
108	7	68.9224.2-42	INFORMES	\N	\N	2026-03-05 20:51:15.626457
109	7	68.9224.2-53	PLANES	\N	\N	2026-03-05 20:51:15.637114
93	8	68.9224.4-27	DERECHOS DE PETICION	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_4","label":"Valor 4"}]	\N	2026-03-05 20:50:55.092016
95	8	68.9224.4-28	DISENO CURRICULAR DE LOS PROGRAMAS DE FORMACION PROFESIONAL INTEGRAL	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.102564
97	8	68.9224.4-37	HISTORIAS ACADEMICAS	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_4","label":"Valor 4"},{"id":"4","type":"meta_5","label":"Valor 5"}]	\N	2026-03-05 20:50:55.179029
101	8	68.9224.4-31	ESTRUCTURAS FUNCIONALES DE LA OCUPACION	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"},{"id":"4","type":"meta_5","label":"Valor 5"}]	\N	2026-03-05 20:50:55.499014
102	8	68.9224.4-49	MAPAS FUNCIONALES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"},{"id":"4","type":"meta_3","label":"Valor 3"}]	\N	2026-03-05 20:50:55.517311
103	8	68.9224.4-51	NORMAS DE COMPETENCIAS LABORALES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"},{"id":"4","type":"meta_5","label":"Valor 5"}]	\N	2026-03-05 20:50:55.531893
105	8	68.9224.4-77	PROCESOS DE EVALUACION Y CERTIFICACION DE COMPETENCIAS LABORALES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"},{"id":"4","type":"meta_2","label":"Valor 2"},{"id":"5","type":"meta_3","label":"Valor 3"}]	\N	2026-03-05 20:50:55.624858
106	7	68.9224.2-07	BANCO DE INSTRUMENTOS DE EVALUACION DE ASPIRANTES A PROGRAMAS DE FORMACION	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_4","label":"Valor 4"},{"id":"4","type":"meta_3","label":"Valor 3"}]	\N	2026-03-05 20:51:15.59825
107	7	68.9224.2-27	DERECHOS DE PETICION	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_4","label":"Valor 4"}]	\N	2026-03-05 20:51:15.62227
86	6	68.9224-27	DERECHOS DE PETICION	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"7","type":"meta_4","label":"Valor 4"}]	{"meta_1":"Valor 1","meta_2":"Valor 2","meta_3":"Valor 3","meta_4":"Valor 4","meta_5":"Valor 5","meta_6":"Valor 6","meta_7":"Valor 7","meta_8":"Valor 8"}	2026-03-05 20:36:34.10086
88	6	68.9224-52	ORDENES DE COMPRA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:34.113775
89	6	68.9224-79	PROCESOS DE RESPONSABILIDAD FISCAL	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"7","type":"meta_2","label":"Valor 2"}]	\N	2026-03-05 20:36:34.127106
90	6	68.9224-64	PROCESOS CONTRACTAULES DECLARADOS DESIERTOS	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:34.139736
91	6	68.9224-65	PROCESOS CONTRACTUALES REVOCADOS	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:34.144207
\.


--
-- Data for Name: trd_subseries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trd_subseries (id, series_id, subseries_code, subseries_name, folder_hierarchy, metadata_labels, created_at) FROM stdin;
142	98	68.9224.4-85.15	PROGRAMAS DE EMPRENDIMIENTO	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.295048
156	92	68.9224.4-02.14	ACTAS DE COMITE DE GESTION DE EVALUACION Y CERTIFICACION DE COMPETENCIAS LABORALES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.622373
139	96	68.9224.4-81.02	PROCESO DE VENTAS DE PRODUCTOS Y SERVICIOS CLIENTES INTERNOS	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.157222
152	92	68.9224.4-02.42	ACTAS DE CONSEJOS EJECUTIVO DE MESAS SECTORIALES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.49506
138	96	68.9224.4-81.01	PROCESOS DE VENTAS DE PRODUCTOS Y SERVICIOS CLIENTES EXTERNO	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.141176
140	98	68.9224.4-85.16	PROGRAMAS DE FORMACION PRESENCIAL Y A DISTANCIA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.237307
137	94	68.9224.4-42.29	INFORMES DE GESTION	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.097469
145	98	68.9224.4-85.04	PROGRAMAS DE APOYOS DE SOSTENIMIENTO REGULAR	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.339764
146	98	68.9224.4-85.05	PROGRAMAS DE APOYOS SOCIOECONOMICOS DE ALIMENTACION	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.364868
147	98	68.9224.4-85.06	PROGRAMAS DE APOYOS SOCIOECONOMICOS DE TRANSPORTE	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.392398
148	98	68.9224.4-85.07	PROGRAMAS DE APOYOS SOCIOECONOMICOS MEDIOS TECNOLOGICOS	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.415679
149	98	68.9224.4-85.08	PROGRAMAS DE ASIGNACION CUPOS INTERNADOS – CENTROS DE CONVIVENCIA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.439042
150	98	68.9224.4-85.09	PROGRAMAS DE ASIGNACION\tDE MONITORIAS POR EXCELENCIA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.457006
144	99	68.9224.4-53.07	PLANES DE ACCION DE BIENESTAR AL APRENDIZ	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_3","label":"Valor 3"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.330287
155	104	68.9224.4-87.02	PROYECTOS ANUAL DE COMPETENCIAS LABORALES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.598895
160	109	68.9224.2-53.39	PLANES INSTITUCIONALES DE LA OFERTA ESPECIAL COMPLEMENTARIA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_3","label":"Valor 3"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:51:15.650363
121	83	68.9224-02.30	ACTAS DE COMITE PRIMARIO	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:31.445941
124	84	68.9224-03.02	RESOLUCIONES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:31.493309
127	85	68.9224-22.07	CONTRATOS DE INTERVENTORIA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:32.36462
130	85	68.9224-22.10	CONTRATOS DE PRESTACION DE SERVICIOS PERSONALES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"6","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:33.422269
133	87	68.9224-42.01	INFORMES A ENTES DE CONTROL	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:34.105086
153	92	68.9224.4-02.54	ACTAS DE REUNION DE MESAS SECTORIALES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.496896
143	98	68.9224.4-85.33	PROGRAMAS SENA EMPRENDE RURAL	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.310925
141	99	68.9224.4-53.21	PLANES DE NEGOCIO FONDO EMPRENDER	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"dep","label":"Código Dependencia"},{"id":"4","type":"meta_4","label":"Valor 4"}]	\N	2026-03-05 20:50:55.277771
154	99	68.9224.4-53.08	PLANES DE ACCION DE MESAS SECTORIALES	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"}]	\N	2026-03-05 20:50:55.588982
151	100	68.9224.4-86.01	PROGRAMA DE APOYOS DE SOSTENIMIENTO FONDO NACIONAL DE LA INDUSTRIA DE LA CONSTRUCCION - FIC	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_2","label":"Valor 2"}]	\N	2026-03-05 20:50:55.474352
157	104	68.9224.4-87.05	PROYECTOS DE INVESTIGACION, INNOVACION Y DIVULGACION - SENNOVA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"},{"id":"4","type":"meta_2","label":"Valor 2"}]	\N	2026-03-05 20:50:55.668229
158	108	68.9224.2-42.29	INFORMES DE GESTION	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"ser_conc","label":"Código Serie (Concatenada)"},{"id":"3","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:51:15.630799
159	109	68.9224.2-53.38	PLANES INSTITUCIONALES DE LA OFERTA ABIERTA TITULADA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_3","label":"Valor 3"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:51:15.639131
161	109	68.9224.2-53.40	PLANES INSTITUCIONALES DE LA OFERTA ESPECIAL\r\nTITULADA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_3","label":"Valor 3"},{"id":"4","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:51:15.661533
122	83	68.9224-02.38	ACTAS DE COMITE TECNICO DE CENTRO	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:31.484223
123	83	68.9224-02.52	ACTAS DE SUBCOMITE CENTRO DE FORMACION INSTITUCIONAL DE GESTION Y DESEMPENO	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:31.488319
125	85	68.9224-22.04	CONTRATOS DE COMPRAVENTA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"7","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:31.499003
126	85	68.9224-22.05	CONTRATOS DE CONSULTORIA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:32.009425
128	85	68.9224-22.08	CONTRATOS DE LICENCIAMIENTO	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"7","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:32.708841
129	85	68.9224-22.09	CONTRATOS DE PRESTACION DE SERVICIOS	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:33.091489
131	85	68.9224-22.11	CONTRATOS DE OBRA	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:33.488143
132	85	68.9224-22.13	CONTRATOS DE SUMINISTROS	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:33.782802
134	87	68.9224-42.02	INFORME A ENTIDADES DEL ESTADO	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:34.10795
135	87	68.9224-42.29	INFORMES DE GESTION	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:36:34.110553
136	92	68.9224.4-02.45	ACTAS DE EQUIPO PEDAGOGICO DE CENTROS	[{"id":"1","type":"dep_conc","label":"Código Dependencia (Concatenada)"},{"id":"2","type":"sub_conc","label":"Código Subserie (Concatenada)"},{"id":"3","type":"meta_1","label":"Valor 1"}]	\N	2026-03-05 20:50:55.046449
\.


--
-- Data for Name: trd_typologies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trd_typologies (id, series_id, subseries_id, typology_name, created_at) FROM stdin;
3593	\N	121	ACTAS DE COMITE PRIMARIO	2026-03-05 20:36:31.463763
3594	\N	122	ACTAS DE COMITE TECNICO DE CENTRO	2026-03-05 20:36:31.485416
3595	\N	123	ACTAS DE SUBCOMITE CENTRO DE FORMACION INSTITUCIONAL DE GESTION Y DESEMPENO	2026-03-05 20:36:31.489437
3596	\N	124	RESOLUCION	2026-03-05 20:36:31.494611
3597	\N	125	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:31.50022
3598	\N	125	ESTUDIOS PREVIOS	2026-03-05 20:36:31.502941
3599	\N	125	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:31.505817
3600	\N	125	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:31.509869
3601	\N	125	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:31.513149
3602	\N	125	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:31.516475
3603	\N	125	ANALISIS SECTOR	2026-03-05 20:36:31.51954
3604	\N	125	MATRIZ DE RIESGOS	2026-03-05 20:36:31.522162
3605	\N	125	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:31.525296
3606	\N	125	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:31.527873
3607	\N	125	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:31.530761
3608	\N	125	FICHA TECNICA DE NEGOCIACION PROVISIONAL	2026-03-05 20:36:31.533211
3609	\N	125	DOCUMENTO DE CONDICIONES ESPECIALES PROVISIONAL	2026-03-05 20:36:31.535535
3610	\N	125	RESOLUCION DE APERTURA	2026-03-05 20:36:31.537584
3611	\N	125	CARTA DE INTENCION	2026-03-05 20:36:31.53973
3612	\N	125	BOLETIN INFORMATIVO	2026-03-05 20:36:31.552406
3613	\N	125	ACTA RUEDA DE SELECCION DE SOCIEDAD COMISIONISTA	2026-03-05 20:36:31.554937
3614	\N	125	OFICIO INFORMATIVO SELECCION DE LA FIRMA COMISIONISTA	2026-03-05 20:36:31.557608
3615	\N	125	SOLICITUD DE DOCUMENTOS PARA ELABORACION CONTRATO DE COMPRAVENTA	2026-03-05 20:36:31.560204
3616	\N	125	PROPUESTA TECNICA Y CERTIFICACIONES DE CONTRATOS EJECUTADOS	2026-03-05 20:36:31.562731
3617	\N	125	CERTIFICADO DE EXISTENCIA Y REPRESENTACION LEGAL DEL CONTRATISTA	2026-03-05 20:36:31.573351
3618	\N	125	ESTATUTOS DE LA PERSONA JURIDICA	2026-03-05 20:36:31.577133
3619	\N	125	AUTORIZACION AL REPRESENTANTE LEGAL PARA SUSCRIBIR CONTRATOS	2026-03-05 20:36:31.581331
3620	\N	125	HOJA DE VIDA DEL DAFP DE LA PERSONA JURIDICA O PERSONA NATURAL	2026-03-05 20:36:31.585147
3621	\N	125	REGISTRO UNICO TRIBUTARIO - RUT	2026-03-05 20:36:31.588944
3622	\N	125	REGISTRO DE INFORMACION TRIBUTARIA	2026-03-05 20:36:31.592969
3623	\N	125	CEDULA DE CIUDADANIA DEL REPRESENTANTE LEGAL DE LA PERSONA JURIDICA O DOCUMENTO DE IDENTIDAD DE LA PERSONA NATURAL	2026-03-05 20:36:31.598544
3624	\N	125	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DISCIPLINARIOS DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:31.60852
3625	\N	125	CERTIFICADO INEXISTENCIA DE ANTECEDENTES FISCALES DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:31.612142
3626	\N	125	CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTANTE LEGAL O DE LA PERSONA NATURAL	2026-03-05 20:36:31.615927
3627	\N	125	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DEL SISTEMA	2026-03-05 20:36:31.620127
3628	\N	125	REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS RNMC	2026-03-05 20:36:31.623797
3629	\N	125	REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM	2026-03-05 20:36:31.627777
3630	\N	125	CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE EDAD	2026-03-05 20:36:31.632034
3631	\N	125	CERTIFICADO DE PAGO DE APORTES PARAFISCALES	2026-03-05 20:36:31.636381
3632	\N	125	CERTIFICACION BANCARIA NO SUPERIOR A 30 DIAS.	2026-03-05 20:36:31.640513
3633	\N	125	ACTO DE JUSTIFICACION DE LA CONTRATACION DIRECTA	2026-03-05 20:36:31.643877
3634	\N	125	MINUTA ELECTRONICA DE CONTRATO	2026-03-05 20:36:31.647053
3635	\N	125	MINUTA DE CONTRATO	2026-03-05 20:36:31.650302
3636	\N	125	DOCUMENTOS DEL COMISIONISTA	2026-03-05 20:36:31.653121
3637	\N	125	CONSOLIDADO DE OBSERVACIONES	2026-03-05 20:36:31.656018
3638	\N	125	CONTRATO DE COMISION	2026-03-05 20:36:31.659236
3639	\N	125	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:31.662087
3640	\N	125	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:31.665639
3641	\N	125	GARANTIAS	2026-03-05 20:36:31.668504
3642	\N	125	APROBACION DE LA GARANTIAS	2026-03-05 20:36:31.671512
3643	\N	125	DOCUMENTOS DE DESIGNACION DE SUPERVISOR	2026-03-05 20:36:31.674708
3644	\N	125	ACTA DE INICIO	2026-03-05 20:36:31.677309
3645	\N	125	CONSOLIDADO DE RESPUESTAS A OBSERVACIONES	2026-03-05 20:36:31.680127
3646	\N	125	BOLETIN INFORMATIVO	2026-03-05 20:36:31.683779
3647	\N	125	ANEXOS AL BOLETIN	2026-03-05 20:36:31.686553
3648	\N	125	FICHA TECNICA DE NEGOCIACION DEFINITIVA	2026-03-05 20:36:31.689062
3649	\N	125	DOCUMENTO DE CONDICIONES ESPECIALES DEFINITIVO	2026-03-05 20:36:31.691678
3650	\N	125	DOCUMENTOS DEL PROVEEDOR SELECCIONADO	2026-03-05 20:36:31.694228
3651	\N	125	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:31.696999
3652	\N	125	PROPUESTA Y DOCUMENTOS PROVEEDOR SELECCIONADO	2026-03-05 20:36:31.699755
3653	\N	125	BOLETIN INFORMATIVO Y SOPORTES	2026-03-05 20:36:31.702523
3654	\N	125	INFORME DE RUEDA DE NEGOCIACION DE LA OPERACION	2026-03-05 20:36:31.705163
3655	\N	125	OPERACION DE MERCADO ABIERTO	2026-03-05 20:36:31.707999
3656	\N	125	BOLETA DE NEGOCIACION	2026-03-05 20:36:31.710444
3657	\N	125	SOLICITUD DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:31.713223
3658	\N	125	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:31.716312
3659	\N	125	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:31.718844
3660	\N	125	GARANTIA DEL PROVEEDOR	2026-03-05 20:36:31.72139
3661	\N	125	APROBACION DE LA GARANTIA DEL PROVEEDOR	2026-03-05 20:36:31.724037
3662	\N	125	FACTURA DEL CONTRATISTA	2026-03-05 20:36:31.726866
3663	\N	125	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:31.729756
3664	\N	125	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:31.733044
3665	\N	125	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:31.735787
3666	\N	125	MINUTA DE MODIFICACION	2026-03-05 20:36:31.73854
3667	\N	125	GARANTIAS	2026-03-05 20:36:31.741471
3668	\N	125	APROBACION DE LAS GARANTIAS	2026-03-05 20:36:31.744406
3669	\N	125	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:31.747394
3670	\N	125	FACTURA DEL CONTRATISTA	2026-03-05 20:36:31.749999
3671	\N	125	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:31.752224
3672	\N	125	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:31.754332
3673	\N	125	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:31.756307
3674	\N	125	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:31.758249
3675	\N	125	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:31.760261
3676	\N	125	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:31.762649
3677	\N	125	MINUTA DE MODIFICACION	2026-03-05 20:36:31.765033
3678	\N	125	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:31.767032
3679	\N	125	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:31.769093
3680	\N	125	GARANTIAS	2026-03-05 20:36:31.771089
3681	\N	125	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:31.773135
3682	\N	125	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:31.775594
3683	\N	125	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:31.778298
3684	\N	125	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:31.780541
3685	\N	125	ACTA DE RECIBO A SATISFACCION	2026-03-05 20:36:31.782774
3686	\N	125	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:31.785548
3687	\N	125	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:31.787635
3688	\N	125	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:31.78972
3689	\N	125	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:31.792447
3690	\N	125	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:31.794757
3691	\N	125	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:31.796921
3692	\N	125	ESTUDIOS PREVIOS	2026-03-05 20:36:31.79937
3693	\N	125	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:31.80243
3694	\N	125	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:31.804565
3695	\N	125	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:31.807414
3696	\N	125	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:31.810623
3697	\N	125	ANALISIS SECTOR	2026-03-05 20:36:31.814079
3698	\N	125	MATRIZ DE RIESGOS	2026-03-05 20:36:31.816782
3699	\N	125	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:31.819204
3700	\N	125	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:31.822903
3701	\N	125	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:31.825914
3702	\N	125	NUMERACION DEL PROCESO DE MINIMA CUANTIA	2026-03-05 20:36:31.828462
3703	\N	125	INVITACION PUBLICA	2026-03-05 20:36:31.831109
3704	\N	125	DOCUMENTO ANEXO A LA INVITACION	2026-03-05 20:36:31.832957
3705	\N	125	OBSERVACIONES A LA INVITACION PUBLICA	2026-03-05 20:36:31.834711
3706	\N	125	RESPUESTAS A LAS OBSERVACIONES DE LA INVITACION PUBLICA	2026-03-05 20:36:31.836381
3707	\N	125	CONSTANCIA DE CIERRE	2026-03-05 20:36:31.83777
3708	\N	125	ADENDAS	2026-03-05 20:36:31.839136
3709	\N	125	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:31.840895
3710	\N	125	INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:31.843013
3711	\N	125	CONSOLIDADO INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:31.84529
3712	\N	125	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:31.846693
3713	\N	125	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:31.848635
3714	\N	125	INFORME DE EVALUACION FINAL REQUISITOS HABILITANTES	2026-03-05 20:36:31.849918
3715	\N	125	RECOMENDACION COMITE EVALUADOR	2026-03-05 20:36:31.851248
3716	\N	125	RESOLUCION DE DECLARATORIA DESIERTA	2026-03-05 20:36:31.852587
3717	\N	125	ACEPTACION DE OFERTA	2026-03-05 20:36:31.853887
3718	\N	125	DOCUMENTO ANEXO ACEPTACION DE OFERTA	2026-03-05 20:36:31.855754
3719	\N	125	CERTIFICADO DE REGISTRO EN BLACKBOX	2026-03-05 20:36:31.858177
3720	\N	125	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:31.859548
3721	\N	125	GARANTIAS	2026-03-05 20:36:31.861296
3722	\N	125	APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:31.862625
3723	\N	125	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:31.864436
3724	\N	125	ACTA DE INICIO	2026-03-05 20:36:31.865985
3725	\N	125	FACTURA DEL CONTRATISTA	2026-03-05 20:36:31.867375
3726	\N	125	SOPORTES INGRESO A ALMACEN	2026-03-05 20:36:31.869284
3727	\N	125	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:31.8708
3728	\N	125	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:31.872778
3729	\N	125	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:31.875029
3730	\N	125	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:31.87739
3731	\N	125	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:31.879114
3732	\N	125	MINUTA DE MODIFICACION	2026-03-05 20:36:31.881274
3733	\N	125	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:31.883349
3734	\N	125	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:31.885108
3735	\N	125	GARANTIAS	2026-03-05 20:36:31.886872
3736	\N	125	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:31.888771
3737	\N	125	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:31.890229
3738	\N	125	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:31.891654
3739	\N	125	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:31.893105
3740	\N	125	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:31.894402
3741	\N	125	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:31.895772
3742	\N	125	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:31.896925
3743	\N	125	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:31.899087
3744	\N	125	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:31.900531
3745	\N	125	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:31.902213
3746	\N	125	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:31.904672
3747	\N	125	ESTUDIOS PREVIOS	2026-03-05 20:36:31.906492
3748	\N	125	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:31.907668
3749	\N	125	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL	2026-03-05 20:36:31.908902
3750	\N	125	ALMACEN	2026-03-05 20:36:31.91022
3751	\N	125	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:31.911348
3752	\N	125	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:31.912554
3753	\N	125	ANALISIS SECTOR	2026-03-05 20:36:31.914274
3754	\N	125	MATRIZ DE RIESGOS	2026-03-05 20:36:31.915741
3755	\N	125	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:31.916874
3756	\N	125	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:31.918078
3757	\N	125	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:31.920935
3758	\N	125	NUMERACION DEL PROCESO	2026-03-05 20:36:31.922481
3759	\N	125	AVISO DE CONVOCATORIA	2026-03-05 20:36:31.923625
3760	\N	125	PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:31.924858
3761	\N	125	ANEXO AL PROYECTO DE PLIEGO	2026-03-05 20:36:31.926041
3762	\N	125	OBSERVACIONES AL PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:31.92767
3763	\N	125	RESPUESTAS A LAS OBSERVACIONES DEL PROYECTO PLIEGOS DE CONDICIONES	2026-03-05 20:36:31.928949
3764	\N	125	RESOLUCION DE APERTURA	2026-03-05 20:36:31.930213
3765	\N	125	RESOLUCION DE REVOCATORIA DEL ACTO QUE ORDENA LA APERTURA	2026-03-05 20:36:31.93206
3766	\N	125	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:31.933458
3767	\N	125	PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:31.935669
3768	\N	125	ANEXO AL PLIEGO DEFINITIVO	2026-03-05 20:36:31.937061
3769	\N	125	OBSERVACIONES AL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:31.938308
3770	\N	125	RESPUESTAS A LAS OBSERVACIONES DEL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:31.939527
3771	\N	125	ADENDAS	2026-03-05 20:36:31.941091
3772	\N	125	ACTO ADMINISTRATIVO DE REVOCATORIA DEL PROCESO	2026-03-05 20:36:31.942731
3773	\N	125	CONSTANCIA DE PUBLICACION DE LISTA DE OFERENTES SECOP II	2026-03-05 20:36:31.943993
3774	\N	125	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:31.945363
3775	\N	125	INFORME DE EVALUACION PRELIMINAR DE REQUISITOS HABILITANTES	2026-03-05 20:36:31.946617
3776	\N	125	CONSOLIDADO INFORME PRELIMINAR	2026-03-05 20:36:31.948099
3777	\N	125	CONSTANCIA PUBLICACION EN SECOP II LISTA DE OFERTAS	2026-03-05 20:36:31.949342
3778	\N	125	RECIBIDAS	2026-03-05 20:36:31.950444
3779	\N	125	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:31.952086
3868	\N	126	BOLETIN INFORMATIVO	2026-03-05 20:36:32.106774
3780	\N	125	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:31.953246
3781	\N	125	INFORME DEFINITIVO DE REQUISITOS HABILITANTES	2026-03-05 20:36:31.954465
3782	\N	125	EVENTO DE SUBASTA INVERSA / APERTURA DE SOBRE ECONOMICO	2026-03-05 20:36:31.955558
3783	\N	125	ACTA DE AUDIENCIA DE SUBASTA O INFORME DE SUBASTA	2026-03-05 20:36:31.956869
3784	\N	125	ELECTRONICA	2026-03-05 20:36:31.958512
3785	\N	125	DOCUMENTO DE RECOMENDACION DEL COMITE EVALUADOR	2026-03-05 20:36:31.960202
3786	\N	125	RESOLUCION DE ADJUDICACION O DECLARATORIA DESIERTA	2026-03-05 20:36:31.962188
3787	\N	125	MINUTA ELECTRONICA DEL CONTRATO	2026-03-05 20:36:31.96341
3788	\N	125	ANEXO AL CONTRATO	2026-03-05 20:36:31.965068
3789	\N	125	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:31.966583
3790	\N	125	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:31.968301
3791	\N	125	GARANTIAS	2026-03-05 20:36:31.96998
3792	\N	125	APROBACION DE LA GARANTIAS	2026-03-05 20:36:31.971291
3793	\N	125	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:31.972444
3794	\N	125	ACTA DE INICIO	2026-03-05 20:36:31.973767
3795	\N	125	FACTURA DEL CONTRATISTA	2026-03-05 20:36:31.975099
3796	\N	125	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:31.97646
3797	\N	125	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:31.978283
3798	\N	125	SOPORTE INGRESO A ALMACEN	2026-03-05 20:36:31.979644
3799	\N	125	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:31.981757
3800	\N	125	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:31.984673
3801	\N	125	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:31.98645
3802	\N	125	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:31.987873
3803	\N	125	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:31.989192
3804	\N	125	MINUTA DE MODIFICACION	2026-03-05 20:36:31.990604
3805	\N	125	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:31.992072
3806	\N	125	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:31.993803
3807	\N	125	GARANTIAS	2026-03-05 20:36:31.995343
3808	\N	125	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:31.997079
3809	\N	125	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:31.999262
3810	\N	125	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:32.000547
3811	\N	125	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:32.00188
3812	\N	125	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:32.003368
3813	\N	125	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:32.004535
3814	\N	125	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:32.005815
3815	\N	125	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:32.006981
3816	\N	125	CONSTANCIA DE PUBLICACION EN SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:32.008174
3817	\N	126	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:32.010004
3818	\N	126	ESTUDIOS PREVIOS	2026-03-05 20:36:32.011769
3819	\N	126	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:32.013285
3820	\N	126	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:32.016049
3821	\N	126	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:32.018211
3822	\N	126	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:32.020235
3823	\N	126	ANALISIS SECTOR	2026-03-05 20:36:32.021825
3824	\N	126	MATRIZ DE RIESGOS	2026-03-05 20:36:32.023412
3825	\N	126	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.025095
3826	\N	126	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:32.02662
3827	\N	126	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:32.028686
3828	\N	126	ACTA DE COMITE DE CONTRATACION NUMERACION PARA CONTRATACION DIRECTA	2026-03-05 20:36:32.031259
3829	\N	126	FICHA TECNICA DE NEGOCIACION PROVISIONAL	2026-03-05 20:36:32.033509
3830	\N	126	CERTIFICACION DE EXCLUSIVIDAD Y UNICO OFERENTE EN EL MERCADO DEL BIEN O SERVICIO O (APLICA A CONTRATOS EN LOS CUALES NO EXISTA PLURALIDAD DE OFERENTES)	2026-03-05 20:36:32.035431
3831	\N	126	DOCUMENTO DE CONDICIONES ESPECIALES PROVISIONAL	2026-03-05 20:36:32.038527
3832	\N	126	RESOLUCION DE APERTURA	2026-03-05 20:36:32.040882
3833	\N	126	CARTA DE INTENCION	2026-03-05 20:36:32.043044
3834	\N	126	BOLETIN INFORMATIVO	2026-03-05 20:36:32.045269
3835	\N	126	ACTA RUEDA DE SELECCION DE SOCIEDAD COMISIONISTA	2026-03-05 20:36:32.047604
3836	\N	126	OFICIO INFORMATIVO SELECCION DE LA FIRMA COMISIONISTA	2026-03-05 20:36:32.049706
3837	\N	126	SOLICITUD DE DOCUMENTOS PARA ELABORACION CONTRATO DE COMPRAVENTA	2026-03-05 20:36:32.051747
3838	\N	126	PROPUESTA TECNICA Y CERTIFICACIONES DE CONTRATOS EJECUTADOS	2026-03-05 20:36:32.05381
3839	\N	126	CERTIFICADO DE EXISTENCIA Y REPRESENTACION LEGAL DEL CONTRATISTA	2026-03-05 20:36:32.055758
3840	\N	126	ESTATUTOS DE LA PERSONA JURIDICA	2026-03-05 20:36:32.057812
3841	\N	126	AUTORIZACION AL REPRESENTANTE LEGAL PARA SUSCRIBIR CONTRATOS	2026-03-05 20:36:32.059639
3842	\N	126	HOJA DE VIDA DEL DAFP DE LA PERSONA JURIDICA O PERSONA NATURAL	2026-03-05 20:36:32.061288
3843	\N	126	REGISTRO UNICO TRIBUTARIO - RUT	2026-03-05 20:36:32.06363
3844	\N	126	REGISTRO DE INFORMACION TRIBUTARIA	2026-03-05 20:36:32.065873
3845	\N	126	CEDULA DE CIUDADANIA DEL REPRESENTANTE LEGAL DE LA PERSONA JURIDICA O DOCUMENTO DE IDENTIDAD DE LA PERSONA NATURAL	2026-03-05 20:36:32.067371
3846	\N	126	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DISCIPLINARIOS DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:32.0688
3847	\N	126	CERTIFICADO INEXISTENCIA DE ANTECEDENTES FISCALES DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:32.070199
3848	\N	126	CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTANTE LEGAL O DE LA PERSONA NATURAL	2026-03-05 20:36:32.071546
3849	\N	126	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DEL SISTEMA	2026-03-05 20:36:32.073207
3850	\N	126	REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS RNMC	2026-03-05 20:36:32.07521
3851	\N	126	REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM	2026-03-05 20:36:32.0777
3852	\N	126	CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE EDAD	2026-03-05 20:36:32.079897
3853	\N	126	CERTIFICADO DE PAGO DE APORTES PARAFISCALES	2026-03-05 20:36:32.081579
3854	\N	126	CERTIFICACION BANCARIA NO SUPERIOR A 30 DIAS.	2026-03-05 20:36:32.0831
3855	\N	126	ACTO DE JUSTIFICACION DE LA CONTRATACION DIRECTA	2026-03-05 20:36:32.084617
3856	\N	126	MINUTA ELECTRONICA DE CONTRATO	2026-03-05 20:36:32.086034
3857	\N	126	MINUTA DE CONTRATO	2026-03-05 20:36:32.08746
3858	\N	126	DOCUMENTOS DEL COMISIONISTA	2026-03-05 20:36:32.089208
3859	\N	126	CONSOLIDADO DE OBSERVACIONES	2026-03-05 20:36:32.090997
3860	\N	126	CONTRATO DE COMISION	2026-03-05 20:36:32.092663
3861	\N	126	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.094665
3862	\N	126	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:32.09626
3863	\N	126	GARANTIAS	2026-03-05 20:36:32.097979
3864	\N	126	APROBACION DE LA GARANTIAS	2026-03-05 20:36:32.099357
3865	\N	126	DOCUMENTOS DE DESIGNACION DE SUPERVISOR	2026-03-05 20:36:32.100861
3866	\N	126	ACTA DE INICIO	2026-03-05 20:36:32.102752
3867	\N	126	CONSOLIDADO DE RESPUESTAS A OBSERVACIONES	2026-03-05 20:36:32.104686
3869	\N	126	ANEXOS AL BOLETIN	2026-03-05 20:36:32.108891
3870	\N	126	FICHA TECNICA DE NEGOCIACION DEFINITIVA	2026-03-05 20:36:32.111285
3871	\N	126	DOCUMENTO DE CONDICIONES ESPECIALES DEFINITIVO	2026-03-05 20:36:32.113214
3872	\N	126	DOCUMENTOS DEL PROVEEDOR SELECCIONADO	2026-03-05 20:36:32.115529
3873	\N	126	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:32.117375
3874	\N	126	PROPUESTA Y DOCUMENTOS PROVEEDOR SELECCIONADO	2026-03-05 20:36:32.119235
3875	\N	126	BOLETIN INFORMATIVO Y SOPORTES	2026-03-05 20:36:32.121247
3876	\N	126	INFORME DE RUEDA DE NEGOCIACION DE LA OPERACION	2026-03-05 20:36:32.123073
3877	\N	126	OPERACION DE MERCADO ABIERTO	2026-03-05 20:36:32.125029
3878	\N	126	BOLETA DE NEGOCIACION	2026-03-05 20:36:32.126607
3879	\N	126	SOLICITUD DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.127988
3880	\N	126	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.129545
3881	\N	126	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.131168
3882	\N	126	GARANTIA DEL PROVEEDOR	2026-03-05 20:36:32.132757
3883	\N	126	APROBACION DE LA GARANTIA DEL PROVEEDOR	2026-03-05 20:36:32.134241
3884	\N	126	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.135707
3885	\N	126	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:32.137202
3886	\N	126	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:32.138328
3887	\N	126	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.13941
3888	\N	126	MINUTA DE MODIFICACION	2026-03-05 20:36:32.14091
3889	\N	126	GARANTIAS	2026-03-05 20:36:32.142275
3890	\N	126	APROBACION DE LAS GARANTIAS	2026-03-05 20:36:32.143854
3891	\N	126	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.145207
3892	\N	126	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.146531
3893	\N	126	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:32.148402
3894	\N	126	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:32.149804
3895	\N	126	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.150926
3896	\N	126	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:32.152021
3897	\N	126	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.153092
3898	\N	126	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:32.15474
3899	\N	126	MINUTA DE MODIFICACION	2026-03-05 20:36:32.155876
3900	\N	126	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.157604
3901	\N	126	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.159542
3902	\N	126	GARANTIAS	2026-03-05 20:36:32.161096
3903	\N	126	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.162858
3904	\N	126	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.164697
3905	\N	126	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:32.166659
3906	\N	126	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:32.1684
3907	\N	126	ACTA DE RECIBO A SATISFACCION	2026-03-05 20:36:32.170363
3908	\N	126	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:32.172246
3909	\N	126	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:32.174859
3910	\N	126	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:32.176982
3911	\N	126	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:32.178805
3912	\N	126	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:32.180362
3913	\N	126	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:32.181902
3914	\N	126	ESTUDIOS PREVIOS	2026-03-05 20:36:32.1831
3915	\N	126	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:32.184508
3916	\N	126	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:32.186787
3917	\N	126	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:32.188265
3918	\N	126	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:32.18946
3919	\N	126	ANALISIS SECTOR	2026-03-05 20:36:32.190661
3920	\N	126	MATRIZ DE RIESGOS	2026-03-05 20:36:32.191908
3921	\N	126	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.193207
3922	\N	126	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:32.194409
3923	\N	126	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:32.195723
3924	\N	126	NUMERACION DEL PROCESO DE MINIMA CUANTIA	2026-03-05 20:36:32.196907
3925	\N	126	INVITACION PUBLICA	2026-03-05 20:36:32.198841
3926	\N	126	DOCUMENTO ANEXO A LA INVITACION	2026-03-05 20:36:32.200771
3927	\N	126	OBSERVACIONES A LA INVITACION PUBLICA	2026-03-05 20:36:32.202802
3928	\N	126	RESPUESTAS A LAS OBSERVACIONES DE LA INVITACION PUBLICA	2026-03-05 20:36:32.204651
3929	\N	126	CONSTANCIA DE CIERRE	2026-03-05 20:36:32.206
3930	\N	126	ADENDAS	2026-03-05 20:36:32.20714
3931	\N	126	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:32.20829
3932	\N	126	INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:32.209944
3933	\N	126	CONSOLIDADO INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:32.211842
3934	\N	126	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.214089
3935	\N	126	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.216083
3936	\N	126	INFORME DE EVALUACION FINAL REQUISITOS HABILITANTES	2026-03-05 20:36:32.217347
3937	\N	126	RECOMENDACION COMITE EVALUADOR	2026-03-05 20:36:32.21893
3938	\N	126	RESOLUCION DE DECLARATORIA DESIERTA	2026-03-05 20:36:32.22032
3939	\N	126	ACEPTACION DE OFERTA	2026-03-05 20:36:32.221557
3940	\N	126	DOCUMENTO ANEXO ACEPTACION DE OFERTA	2026-03-05 20:36:32.223296
3941	\N	126	CERTIFICADO DE REGISTRO EN BLACKBOX	2026-03-05 20:36:32.224939
3942	\N	126	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.226226
3943	\N	126	GARANTIAS	2026-03-05 20:36:32.227443
3944	\N	126	APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.22867
3945	\N	126	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:32.230858
3946	\N	126	ACTA DE INICIO	2026-03-05 20:36:32.232696
3947	\N	126	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.234179
3948	\N	126	SOPORTES INGRESO A ALMACEN	2026-03-05 20:36:32.235326
3949	\N	126	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:32.236406
3950	\N	126	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.237798
3951	\N	126	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.239022
3952	\N	126	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:32.240123
3953	\N	126	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:32.241382
3954	\N	126	MINUTA DE MODIFICACION	2026-03-05 20:36:32.242683
3955	\N	126	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.243896
3956	\N	126	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:32.245651
3957	\N	126	GARANTIAS	2026-03-05 20:36:32.246861
3958	\N	126	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.248438
3959	\N	126	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.250045
3960	\N	126	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:32.251168
3961	\N	126	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:32.252231
3962	\N	126	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:32.253359
3963	\N	126	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:32.254448
3964	\N	126	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:32.255563
3965	\N	126	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:32.256675
3966	\N	126	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:32.258852
3967	\N	126	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:32.260523
3968	\N	126	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:32.261976
3969	\N	126	ESTUDIOS PREVIOS	2026-03-05 20:36:32.263332
3970	\N	126	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:32.265636
3971	\N	126	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL	2026-03-05 20:36:32.267585
3972	\N	126	ALMACEN	2026-03-05 20:36:32.269088
3973	\N	126	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:32.270388
3974	\N	126	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:32.271626
3975	\N	126	ANALISIS SECTOR	2026-03-05 20:36:32.27303
3976	\N	126	MATRIZ DE RIESGOS	2026-03-05 20:36:32.275179
3977	\N	126	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.27648
3978	\N	126	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:32.277714
3979	\N	126	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:32.279032
3980	\N	126	NUMERACION DEL PROCESO	2026-03-05 20:36:32.280677
3981	\N	126	AVISO DE CONVOCATORIA	2026-03-05 20:36:32.282778
3982	\N	126	PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:32.28401
3983	\N	126	ANEXO AL PROYECTO DE PLIEGO	2026-03-05 20:36:32.28527
3984	\N	126	OBSERVACIONES AL PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:32.286461
3985	\N	126	RESPUESTAS A LAS OBSERVACIONES DEL PROYECTO PLIEGOS DE CONDICIONES	2026-03-05 20:36:32.28759
3986	\N	126	RESOLUCION DE APERTURA	2026-03-05 20:36:32.288697
3987	\N	126	RESOLUCION DE REVOCATORIA DEL ACTO QUE ORDENA LA APERTURA	2026-03-05 20:36:32.290633
3988	\N	126	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:32.292052
3989	\N	126	PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:32.293249
3990	\N	126	ANEXO AL PLIEGO DEFINITIVO	2026-03-05 20:36:32.294442
3991	\N	126	OBSERVACIONES AL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:32.295739
3992	\N	126	RESPUESTAS A LAS OBSERVACIONES DEL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:32.298224
3993	\N	126	ADENDAS	2026-03-05 20:36:32.29979
3994	\N	126	ACTO ADMINISTRATIVO DE REVOCATORIA DEL PROCESO	2026-03-05 20:36:32.300971
3995	\N	126	CONSTANCIA DE PUBLICACION DE LISTA DE OFERENTES SECOP II	2026-03-05 20:36:32.302112
3996	\N	126	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:32.303211
3997	\N	126	INFORME DE EVALUACION PRELIMINAR DE REQUISITOS HABILITANTES	2026-03-05 20:36:32.304394
3998	\N	126	CONSOLIDADO INFORME PRELIMINAR	2026-03-05 20:36:32.305625
3999	\N	126	CONSTANCIA PUBLICACION EN SECOP II LISTA DE OFERTAS	2026-03-05 20:36:32.306872
4000	\N	126	RECIBIDAS	2026-03-05 20:36:32.308036
4001	\N	126	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.311065
4002	\N	126	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.312958
4003	\N	126	INFORME DEFINITIVO DE REQUISITOS HABILITANTES	2026-03-05 20:36:32.315924
4004	\N	126	EVENTO DE SUBASTA INVERSA / APERTURA DE SOBRE ECONOMICO	2026-03-05 20:36:32.317631
4005	\N	126	ACTA DE AUDIENCIA DE SUBASTA O INFORME DE SUBASTA	2026-03-05 20:36:32.319205
4006	\N	126	ELECTRONICA	2026-03-05 20:36:32.320481
4007	\N	126	DOCUMENTO DE RECOMENDACION DEL COMITE EVALUADOR	2026-03-05 20:36:32.321687
4008	\N	126	RESOLUCION DE ADJUDICACION O DECLARATORIA DESIERTA	2026-03-05 20:36:32.323001
4009	\N	126	MINUTA ELECTRONICA DEL CONTRATO	2026-03-05 20:36:32.324218
4010	\N	126	ANEXO AL CONTRATO	2026-03-05 20:36:32.325494
4011	\N	126	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.326697
4012	\N	126	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.327899
4013	\N	126	GARANTIAS	2026-03-05 20:36:32.329108
4014	\N	126	APROBACION DE LA GARANTIAS	2026-03-05 20:36:32.33091
4015	\N	126	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:32.332637
4016	\N	126	ACTA DE INICIO	2026-03-05 20:36:32.334129
4017	\N	126	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.335493
4018	\N	126	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:32.336635
4019	\N	126	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:32.337745
4020	\N	126	SOPORTE INGRESO A ALMACEN	2026-03-05 20:36:32.33883
4021	\N	126	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:32.33992
4022	\N	126	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.340996
4023	\N	126	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:32.342165
4024	\N	126	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.343236
4025	\N	126	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:32.344325
4026	\N	126	MINUTA DE MODIFICACION	2026-03-05 20:36:32.345513
4027	\N	126	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.347341
4028	\N	126	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:32.349356
4029	\N	126	GARANTIAS	2026-03-05 20:36:32.350652
4030	\N	126	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.351716
4031	\N	126	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.352933
4032	\N	126	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:32.354584
4033	\N	126	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:32.355708
4034	\N	126	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:32.356876
4035	\N	126	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:32.358205
4036	\N	126	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:32.35939
4037	\N	126	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:32.360961
4038	\N	126	CONSTANCIA DE PUBLICACION EN SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:32.36234
4039	\N	127	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:32.365515
4040	\N	127	ESTUDIOS PREVIOS	2026-03-05 20:36:32.366883
4041	\N	127	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:32.368112
4042	\N	127	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:32.369323
4043	\N	127	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:32.37053
4044	\N	127	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:32.37173
4045	\N	127	ANALISIS SECTOR	2026-03-05 20:36:32.372921
4046	\N	127	MATRIZ DE RIESGOS	2026-03-05 20:36:32.37415
4047	\N	127	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.375499
4048	\N	127	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:32.376718
4049	\N	127	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:32.377971
4050	\N	127	ACTA DE COMITE DE CONTRATACION NUMERACION PARA CONTRATACION DIRECTA	2026-03-05 20:36:32.379326
4051	\N	127	FICHA TECNICA DE NEGOCIACION PROVISIONAL	2026-03-05 20:36:32.381779
4052	\N	127	CERTIFICACION DE EXCLUSIVIDAD Y UNICO OFERENTE EN EL MERCADO DEL BIEN O SERVICIO O (APLICA A CONTRATOS EN LOS CUALES NO EXISTA PLURALIDAD DE OFERENTES)	2026-03-05 20:36:32.384594
4053	\N	127	DOCUMENTO DE CONDICIONES ESPECIALES PROVISIONAL	2026-03-05 20:36:32.386708
4054	\N	127	RESOLUCION DE APERTURA	2026-03-05 20:36:32.388108
4055	\N	127	CARTA DE INTENCION	2026-03-05 20:36:32.38922
4056	\N	127	BOLETIN INFORMATIVO	2026-03-05 20:36:32.390384
4057	\N	127	ACTA RUEDA DE SELECCION DE SOCIEDAD COMISIONISTA	2026-03-05 20:36:32.391455
4058	\N	127	OFICIO INFORMATIVO SELECCION DE LA FIRMA COMISIONISTA	2026-03-05 20:36:32.392654
4151	\N	127	CONSTANCIA DE CIERRE	2026-03-05 20:36:32.550557
4059	\N	127	SOLICITUD DE DOCUMENTOS PARA ELABORACION CONTRATO DE COMPRAVENTA	2026-03-05 20:36:32.394824
4060	\N	127	PROPUESTA TECNICA Y CERTIFICACIONES DE CONTRATOS EJECUTADOS	2026-03-05 20:36:32.396166
4061	\N	127	CERTIFICADO DE EXISTENCIA Y REPRESENTACION LEGAL DEL CONTRATISTA	2026-03-05 20:36:32.397993
4062	\N	127	ESTATUTOS DE LA PERSONA JURIDICA	2026-03-05 20:36:32.400142
4063	\N	127	AUTORIZACION AL REPRESENTANTE LEGAL PARA SUSCRIBIR CONTRATOS	2026-03-05 20:36:32.402185
4064	\N	127	HOJA DE VIDA DEL DAFP DE LA PERSONA JURIDICA O PERSONA NATURAL	2026-03-05 20:36:32.403513
4065	\N	127	REGISTRO UNICO TRIBUTARIO - RUT	2026-03-05 20:36:32.40503
4066	\N	127	REGISTRO DE INFORMACION TRIBUTARIA	2026-03-05 20:36:32.406244
4067	\N	127	CEDULA DE CIUDADANIA DEL REPRESENTANTE LEGAL DE LA PERSONA JURIDICA O DOCUMENTO DE IDENTIDAD DE LA PERSONA NATURAL	2026-03-05 20:36:32.407403
4068	\N	127	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DISCIPLINARIOS DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:32.408579
4069	\N	127	CERTIFICADO INEXISTENCIA DE ANTECEDENTES FISCALES DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:32.410615
4070	\N	127	CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTANTE LEGAL O DE LA PERSONA NATURAL	2026-03-05 20:36:32.411865
4071	\N	127	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DEL SISTEMA	2026-03-05 20:36:32.413424
4072	\N	127	REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS RNMC	2026-03-05 20:36:32.415964
4073	\N	127	REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM	2026-03-05 20:36:32.41806
4074	\N	127	CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE EDAD	2026-03-05 20:36:32.419632
4075	\N	127	CERTIFICADO DE PAGO DE APORTES PARAFISCALES	2026-03-05 20:36:32.420956
4076	\N	127	CERTIFICACION BANCARIA NO SUPERIOR A 30 DIAS.	2026-03-05 20:36:32.422184
4077	\N	127	ACTO DE JUSTIFICACION DE LA CONTRATACION DIRECTA	2026-03-05 20:36:32.423417
4078	\N	127	MINUTA ELECTRONICA DE CONTRATO	2026-03-05 20:36:32.424841
4079	\N	127	MINUTA DE CONTRATO	2026-03-05 20:36:32.427093
4080	\N	127	DOCUMENTOS DEL COMISIONISTA	2026-03-05 20:36:32.42844
4081	\N	127	CONSOLIDADO DE OBSERVACIONES	2026-03-05 20:36:32.429686
4082	\N	127	CONTRATO DE COMISION	2026-03-05 20:36:32.431691
4083	\N	127	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.433705
4084	\N	127	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:32.435342
4085	\N	127	GARANTIAS	2026-03-05 20:36:32.436595
4086	\N	127	APROBACION DE LA GARANTIAS	2026-03-05 20:36:32.437727
4087	\N	127	DOCUMENTOS DE DESIGNACION DE SUPERVISOR	2026-03-05 20:36:32.438874
4088	\N	127	ACTA DE INICIO	2026-03-05 20:36:32.440052
4089	\N	127	CONSOLIDADO DE RESPUESTAS A OBSERVACIONES	2026-03-05 20:36:32.442522
4090	\N	127	BOLETIN INFORMATIVO	2026-03-05 20:36:32.444592
4091	\N	127	ANEXOS AL BOLETIN	2026-03-05 20:36:32.445785
4092	\N	127	FICHA TECNICA DE NEGOCIACION DEFINITIVA	2026-03-05 20:36:32.446866
4093	\N	127	DOCUMENTO DE CONDICIONES ESPECIALES DEFINITIVO	2026-03-05 20:36:32.448711
4094	\N	127	DOCUMENTOS DEL PROVEEDOR SELECCIONADO	2026-03-05 20:36:32.45048
4095	\N	127	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:32.45171
4096	\N	127	PROPUESTA Y DOCUMENTOS PROVEEDOR SELECCIONADO	2026-03-05 20:36:32.452826
4097	\N	127	BOLETIN INFORMATIVO Y SOPORTES	2026-03-05 20:36:32.453945
4098	\N	127	INFORME DE RUEDA DE NEGOCIACION DE LA OPERACION	2026-03-05 20:36:32.455013
4099	\N	127	OPERACION DE MERCADO ABIERTO	2026-03-05 20:36:32.456103
4100	\N	127	BOLETA DE NEGOCIACION	2026-03-05 20:36:32.457707
4101	\N	127	SOLICITUD DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.460187
4102	\N	127	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.461441
4103	\N	127	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.463112
4104	\N	127	GARANTIA DEL PROVEEDOR	2026-03-05 20:36:32.464918
4105	\N	127	APROBACION DE LA GARANTIA DEL PROVEEDOR	2026-03-05 20:36:32.466444
4106	\N	127	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.467912
4107	\N	127	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:32.469187
4108	\N	127	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:32.470436
4109	\N	127	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.471635
4110	\N	127	MINUTA DE MODIFICACION	2026-03-05 20:36:32.473097
4111	\N	127	GARANTIAS	2026-03-05 20:36:32.477239
4112	\N	127	APROBACION DE LAS GARANTIAS	2026-03-05 20:36:32.480413
4113	\N	127	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.483979
4114	\N	127	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.48614
4115	\N	127	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:32.487721
4116	\N	127	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:32.489469
4117	\N	127	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.49106
4118	\N	127	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:32.492562
4119	\N	127	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.49391
4120	\N	127	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:32.495242
4121	\N	127	MINUTA DE MODIFICACION	2026-03-05 20:36:32.49642
4122	\N	127	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.498904
4123	\N	127	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.502044
4124	\N	127	GARANTIAS	2026-03-05 20:36:32.503802
4125	\N	127	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.508341
4126	\N	127	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.510067
4127	\N	127	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:32.511912
4128	\N	127	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:32.515637
4129	\N	127	ACTA DE RECIBO A SATISFACCION	2026-03-05 20:36:32.51696
4130	\N	127	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:32.518233
4131	\N	127	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:32.519981
4132	\N	127	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:32.52123
4133	\N	127	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:32.522908
4134	\N	127	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:32.524152
4135	\N	127	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:32.525342
4136	\N	127	ESTUDIOS PREVIOS	2026-03-05 20:36:32.526408
4137	\N	127	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:32.527821
4138	\N	127	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:32.529244
4139	\N	127	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:32.530797
4140	\N	127	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:32.533201
4141	\N	127	ANALISIS SECTOR	2026-03-05 20:36:32.534744
4142	\N	127	MATRIZ DE RIESGOS	2026-03-05 20:36:32.536108
4143	\N	127	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.53791
4144	\N	127	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:32.539741
4145	\N	127	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:32.541374
4146	\N	127	NUMERACION DEL PROCESO DE MINIMA CUANTIA	2026-03-05 20:36:32.542725
4147	\N	127	INVITACION PUBLICA	2026-03-05 20:36:32.543979
4148	\N	127	DOCUMENTO ANEXO A LA INVITACION	2026-03-05 20:36:32.545915
4149	\N	127	OBSERVACIONES A LA INVITACION PUBLICA	2026-03-05 20:36:32.548203
4150	\N	127	RESPUESTAS A LAS OBSERVACIONES DE LA INVITACION PUBLICA	2026-03-05 20:36:32.549446
4152	\N	127	ADENDAS	2026-03-05 20:36:32.551633
4153	\N	127	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:32.553381
4154	\N	127	INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:32.554469
4155	\N	127	CONSOLIDADO INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:32.55561
4156	\N	127	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.556816
4157	\N	127	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.557908
4158	\N	127	INFORME DE EVALUACION FINAL REQUISITOS HABILITANTES	2026-03-05 20:36:32.559031
4159	\N	127	RECOMENDACION COMITE EVALUADOR	2026-03-05 20:36:32.560099
4160	\N	127	RESOLUCION DE DECLARATORIA DESIERTA	2026-03-05 20:36:32.561638
4161	\N	127	ACEPTACION DE OFERTA	2026-03-05 20:36:32.563329
4162	\N	127	DOCUMENTO ANEXO ACEPTACION DE OFERTA	2026-03-05 20:36:32.565436
4163	\N	127	CERTIFICADO DE REGISTRO EN BLACKBOX	2026-03-05 20:36:32.566585
4164	\N	127	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.567652
4165	\N	127	GARANTIAS	2026-03-05 20:36:32.568699
4166	\N	127	APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.570565
4167	\N	127	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:32.572058
4168	\N	127	ACTA DE INICIO	2026-03-05 20:36:32.573286
4169	\N	127	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.574425
4170	\N	127	SOPORTES INGRESO A ALMACEN	2026-03-05 20:36:32.575487
4171	\N	127	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:32.576748
4172	\N	127	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.578949
4173	\N	127	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.58048
4174	\N	127	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:32.582731
4175	\N	127	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:32.584289
4176	\N	127	MINUTA DE MODIFICACION	2026-03-05 20:36:32.586254
4177	\N	127	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.587765
4178	\N	127	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:32.589233
4179	\N	127	GARANTIAS	2026-03-05 20:36:32.590506
4180	\N	127	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.591847
4181	\N	127	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.593738
4182	\N	127	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:32.595466
4183	\N	127	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:32.597234
4184	\N	127	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:32.599116
4185	\N	127	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:32.600403
4186	\N	127	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:32.601464
4187	\N	127	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:32.602531
4188	\N	127	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:32.603654
4189	\N	127	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:32.60475
4190	\N	127	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:32.605836
4191	\N	127	ESTUDIOS PREVIOS	2026-03-05 20:36:32.607043
4192	\N	127	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:32.608203
4193	\N	127	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL	2026-03-05 20:36:32.609544
4194	\N	127	ALMACEN	2026-03-05 20:36:32.610633
4195	\N	127	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:32.611691
4196	\N	127	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:32.613291
4197	\N	127	ANALISIS SECTOR	2026-03-05 20:36:32.615104
4198	\N	127	MATRIZ DE RIESGOS	2026-03-05 20:36:32.616541
4199	\N	127	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.617913
4200	\N	127	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:32.619044
4201	\N	127	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:32.620118
4202	\N	127	NUMERACION DEL PROCESO	2026-03-05 20:36:32.621163
4203	\N	127	AVISO DE CONVOCATORIA	2026-03-05 20:36:32.622207
4204	\N	127	PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:32.623293
4205	\N	127	ANEXO AL PROYECTO DE PLIEGO	2026-03-05 20:36:32.624393
4206	\N	127	OBSERVACIONES AL PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:32.626294
4207	\N	127	RESPUESTAS A LAS OBSERVACIONES DEL PROYECTO PLIEGOS DE CONDICIONES	2026-03-05 20:36:32.627885
4208	\N	127	RESOLUCION DE APERTURA	2026-03-05 20:36:32.629375
4209	\N	127	RESOLUCION DE REVOCATORIA DEL ACTO QUE ORDENA LA APERTURA	2026-03-05 20:36:32.632054
4210	\N	127	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:32.634258
4211	\N	127	PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:32.635658
4212	\N	127	ANEXO AL PLIEGO DEFINITIVO	2026-03-05 20:36:32.636885
4213	\N	127	OBSERVACIONES AL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:32.63837
4214	\N	127	RESPUESTAS A LAS OBSERVACIONES DEL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:32.639733
4215	\N	127	ADENDAS	2026-03-05 20:36:32.641332
4216	\N	127	ACTO ADMINISTRATIVO DE REVOCATORIA DEL PROCESO	2026-03-05 20:36:32.643004
4217	\N	127	CONSTANCIA DE PUBLICACION DE LISTA DE OFERENTES SECOP II	2026-03-05 20:36:32.644571
4218	\N	127	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:32.646403
4219	\N	127	INFORME DE EVALUACION PRELIMINAR DE REQUISITOS HABILITANTES	2026-03-05 20:36:32.648995
4220	\N	127	CONSOLIDADO INFORME PRELIMINAR	2026-03-05 20:36:32.651056
4221	\N	127	CONSTANCIA PUBLICACION EN SECOP II LISTA DE OFERTAS	2026-03-05 20:36:32.652285
4222	\N	127	RECIBIDAS	2026-03-05 20:36:32.653657
4223	\N	127	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.654728
4224	\N	127	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.655807
4225	\N	127	INFORME DEFINITIVO DE REQUISITOS HABILITANTES	2026-03-05 20:36:32.657049
4226	\N	127	EVENTO DE SUBASTA INVERSA / APERTURA DE SOBRE ECONOMICO	2026-03-05 20:36:32.658518
4227	\N	127	ACTA DE AUDIENCIA DE SUBASTA O INFORME DE SUBASTA	2026-03-05 20:36:32.659681
4228	\N	127	ELECTRONICA	2026-03-05 20:36:32.660805
4229	\N	127	DOCUMENTO DE RECOMENDACION DEL COMITE EVALUADOR	2026-03-05 20:36:32.661859
4230	\N	127	RESOLUCION DE ADJUDICACION O DECLARATORIA DESIERTA	2026-03-05 20:36:32.663011
4231	\N	127	MINUTA ELECTRONICA DEL CONTRATO	2026-03-05 20:36:32.665235
4232	\N	127	ANEXO AL CONTRATO	2026-03-05 20:36:32.666977
4233	\N	127	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.668288
4234	\N	127	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.669374
4235	\N	127	GARANTIAS	2026-03-05 20:36:32.670475
4236	\N	127	APROBACION DE LA GARANTIAS	2026-03-05 20:36:32.671543
4237	\N	127	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:32.67262
4238	\N	127	ACTA DE INICIO	2026-03-05 20:36:32.674391
4239	\N	127	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.67573
4240	\N	127	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:32.676821
4241	\N	127	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:32.677857
4242	\N	127	SOPORTE INGRESO A ALMACEN	2026-03-05 20:36:32.679009
4243	\N	127	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:32.680111
4244	\N	127	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.6829
4245	\N	127	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:32.68439
4246	\N	127	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.685632
4247	\N	127	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:32.686837
4248	\N	127	MINUTA DE MODIFICACION	2026-03-05 20:36:32.688022
4249	\N	127	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.690242
4250	\N	127	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:32.691848
4251	\N	127	GARANTIAS	2026-03-05 20:36:32.693117
4252	\N	127	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.694595
4253	\N	127	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.696033
4254	\N	127	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:32.698517
4255	\N	127	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:32.700593
4256	\N	127	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:32.701837
4257	\N	127	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:32.703054
4258	\N	127	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:32.704339
4259	\N	127	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:32.706318
4260	\N	127	CONSTANCIA DE PUBLICACION EN SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:32.707507
4261	\N	128	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:32.709427
4262	\N	128	ESTUDIOS PREVIOS	2026-03-05 20:36:32.710509
4263	\N	128	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:32.711595
4264	\N	128	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:32.71272
4265	\N	128	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:32.715105
4266	\N	128	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:32.716635
4267	\N	128	ANALISIS SECTOR	2026-03-05 20:36:32.717798
4268	\N	128	MATRIZ DE RIESGOS	2026-03-05 20:36:32.718872
4269	\N	128	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.720088
4270	\N	128	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:32.722075
4271	\N	128	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:32.723383
4272	\N	128	ACTA DE COMITE DE CONTRATACION NUMERACION PARA CONTRATACION DIRECTA	2026-03-05 20:36:32.724611
4273	\N	128	FICHA TECNICA DE NEGOCIACION PROVISIONAL	2026-03-05 20:36:32.725734
4274	\N	128	CERTIFICACION DE EXCLUSIVIDAD Y UNICO OFERENTE EN EL MERCADO DEL BIEN O SERVICIO O (APLICA A CONTRATOS EN LOS CUALES NO EXISTA PLURALIDAD DE OFERENTES)	2026-03-05 20:36:32.726793
4275	\N	128	DOCUMENTO DE CONDICIONES ESPECIALES PROVISIONAL	2026-03-05 20:36:32.727851
4276	\N	128	RESOLUCION DE APERTURA	2026-03-05 20:36:32.729074
4277	\N	128	CARTA DE INTENCION	2026-03-05 20:36:32.731404
4278	\N	128	BOLETIN INFORMATIVO	2026-03-05 20:36:32.733196
4279	\N	128	ACTA RUEDA DE SELECCION DE SOCIEDAD COMISIONISTA	2026-03-05 20:36:32.734873
4280	\N	128	OFICIO INFORMATIVO SELECCION DE LA FIRMA COMISIONISTA	2026-03-05 20:36:32.736281
4281	\N	128	SOLICITUD DE DOCUMENTOS PARA ELABORACION CONTRATO DE COMPRAVENTA	2026-03-05 20:36:32.738555
4282	\N	128	PROPUESTA TECNICA Y CERTIFICACIONES DE CONTRATOS EJECUTADOS	2026-03-05 20:36:32.740538
4283	\N	128	CERTIFICADO DE EXISTENCIA Y REPRESENTACION LEGAL DEL CONTRATISTA	2026-03-05 20:36:32.742442
4284	\N	128	ESTATUTOS DE LA PERSONA JURIDICA	2026-03-05 20:36:32.743745
4285	\N	128	AUTORIZACION AL REPRESENTANTE LEGAL PARA SUSCRIBIR CONTRATOS	2026-03-05 20:36:32.745451
4286	\N	128	HOJA DE VIDA DEL DAFP DE LA PERSONA JURIDICA O PERSONA NATURAL	2026-03-05 20:36:32.747878
4287	\N	128	REGISTRO UNICO TRIBUTARIO - RUT	2026-03-05 20:36:32.749611
4288	\N	128	REGISTRO DE INFORMACION TRIBUTARIA	2026-03-05 20:36:32.751058
4289	\N	128	CEDULA DE CIUDADANIA DEL REPRESENTANTE LEGAL DE LA PERSONA JURIDICA O DOCUMENTO DE IDENTIDAD DE LA PERSONA NATURAL	2026-03-05 20:36:32.752372
4290	\N	128	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DISCIPLINARIOS DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:32.75446
4291	\N	128	CERTIFICADO INEXISTENCIA DE ANTECEDENTES FISCALES DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:32.755761
4292	\N	128	CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTANTE LEGAL O DE LA PERSONA NATURAL	2026-03-05 20:36:32.75698
4293	\N	128	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DEL SISTEMA	2026-03-05 20:36:32.758085
4294	\N	128	REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS RNMC	2026-03-05 20:36:32.759168
4295	\N	128	REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM	2026-03-05 20:36:32.760221
4296	\N	128	CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE EDAD	2026-03-05 20:36:32.76184
4297	\N	128	CERTIFICADO DE PAGO DE APORTES PARAFISCALES	2026-03-05 20:36:32.763448
4298	\N	128	CERTIFICACION BANCARIA NO SUPERIOR A 30 DIAS.	2026-03-05 20:36:32.76544
4299	\N	128	ACTO DE JUSTIFICACION DE LA CONTRATACION DIRECTA	2026-03-05 20:36:32.766722
4300	\N	128	MINUTA ELECTRONICA DE CONTRATO	2026-03-05 20:36:32.767805
4301	\N	128	MINUTA DE CONTRATO	2026-03-05 20:36:32.769002
4302	\N	128	DOCUMENTOS DEL COMISIONISTA	2026-03-05 20:36:32.770772
4303	\N	128	CONSOLIDADO DE OBSERVACIONES	2026-03-05 20:36:32.771999
4304	\N	128	CONTRATO DE COMISION	2026-03-05 20:36:32.77316
4305	\N	128	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.774319
4306	\N	128	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:32.775556
4307	\N	128	GARANTIAS	2026-03-05 20:36:32.776943
4308	\N	128	APROBACION DE LA GARANTIAS	2026-03-05 20:36:32.778687
4309	\N	128	DOCUMENTOS DE DESIGNACION DE SUPERVISOR	2026-03-05 20:36:32.780714
4310	\N	128	ACTA DE INICIO	2026-03-05 20:36:32.782377
4311	\N	128	CONSOLIDADO DE RESPUESTAS A OBSERVACIONES	2026-03-05 20:36:32.783742
4312	\N	128	BOLETIN INFORMATIVO	2026-03-05 20:36:32.784892
4313	\N	128	ANEXOS AL BOLETIN	2026-03-05 20:36:32.787285
4314	\N	128	FICHA TECNICA DE NEGOCIACION DEFINITIVA	2026-03-05 20:36:32.788677
4315	\N	128	DOCUMENTO DE CONDICIONES ESPECIALES DEFINITIVO	2026-03-05 20:36:32.789909
4316	\N	128	DOCUMENTOS DEL PROVEEDOR SELECCIONADO	2026-03-05 20:36:32.791099
4317	\N	128	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:32.792496
4318	\N	128	PROPUESTA Y DOCUMENTOS PROVEEDOR SELECCIONADO	2026-03-05 20:36:32.795036
4319	\N	128	BOLETIN INFORMATIVO Y SOPORTES	2026-03-05 20:36:32.796645
4320	\N	128	INFORME DE RUEDA DE NEGOCIACION DE LA OPERACION	2026-03-05 20:36:32.798685
4321	\N	128	OPERACION DE MERCADO ABIERTO	2026-03-05 20:36:32.799935
4322	\N	128	BOLETA DE NEGOCIACION	2026-03-05 20:36:32.80208
4323	\N	128	SOLICITUD DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.803732
4324	\N	128	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.805097
4325	\N	128	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.806557
4326	\N	128	GARANTIA DEL PROVEEDOR	2026-03-05 20:36:32.80787
4327	\N	128	APROBACION DE LA GARANTIA DEL PROVEEDOR	2026-03-05 20:36:32.809516
4328	\N	128	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.810902
4329	\N	128	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:32.812012
4330	\N	128	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:32.814154
4331	\N	128	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.816206
4332	\N	128	MINUTA DE MODIFICACION	2026-03-05 20:36:32.817983
4333	\N	128	GARANTIAS	2026-03-05 20:36:32.819363
4334	\N	128	APROBACION DE LAS GARANTIAS	2026-03-05 20:36:32.820436
4335	\N	128	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.821485
4336	\N	128	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.822526
4337	\N	128	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:32.823622
4338	\N	128	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:32.824963
4339	\N	128	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.826942
4340	\N	128	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:32.828049
4341	\N	128	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.829097
4342	\N	128	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:32.830205
4343	\N	128	MINUTA DE MODIFICACION	2026-03-05 20:36:32.832362
4344	\N	128	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.834916
4345	\N	128	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.836421
4346	\N	128	GARANTIAS	2026-03-05 20:36:32.837522
4347	\N	128	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.838586
4348	\N	128	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.840142
4349	\N	128	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:32.842252
4350	\N	128	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:32.843651
4351	\N	128	ACTA DE RECIBO A SATISFACCION	2026-03-05 20:36:32.844941
4352	\N	128	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:32.846146
4353	\N	128	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:32.848236
4354	\N	128	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:32.850729
4355	\N	128	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:32.853374
4356	\N	128	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:32.85498
4357	\N	128	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:32.856293
4358	\N	128	ESTUDIOS PREVIOS	2026-03-05 20:36:32.858267
4359	\N	128	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:32.859733
4360	\N	128	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:32.861141
4361	\N	128	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:32.862415
4362	\N	128	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:32.86364
4363	\N	128	ANALISIS SECTOR	2026-03-05 20:36:32.86613
4364	\N	128	MATRIZ DE RIESGOS	2026-03-05 20:36:32.867402
4365	\N	128	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.868591
4366	\N	128	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:32.86974
4367	\N	128	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:32.871197
4368	\N	128	NUMERACION DEL PROCESO DE MINIMA CUANTIA	2026-03-05 20:36:32.872249
4369	\N	128	INVITACION PUBLICA	2026-03-05 20:36:32.873668
4370	\N	128	DOCUMENTO ANEXO A LA INVITACION	2026-03-05 20:36:32.875221
4371	\N	128	OBSERVACIONES A LA INVITACION PUBLICA	2026-03-05 20:36:32.876294
4372	\N	128	RESPUESTAS A LAS OBSERVACIONES DE LA INVITACION PUBLICA	2026-03-05 20:36:32.87735
4373	\N	128	CONSTANCIA DE CIERRE	2026-03-05 20:36:32.878413
4374	\N	128	ADENDAS	2026-03-05 20:36:32.879461
4375	\N	128	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:32.881037
4376	\N	128	INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:32.882971
4377	\N	128	CONSOLIDADO INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:32.884107
4378	\N	128	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.885227
4379	\N	128	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:32.886306
4380	\N	128	INFORME DE EVALUACION FINAL REQUISITOS HABILITANTES	2026-03-05 20:36:32.887358
4381	\N	128	RECOMENDACION COMITE EVALUADOR	2026-03-05 20:36:32.88844
4382	\N	128	RESOLUCION DE DECLARATORIA DESIERTA	2026-03-05 20:36:32.890218
4383	\N	128	ACEPTACION DE OFERTA	2026-03-05 20:36:32.891838
4384	\N	128	DOCUMENTO ANEXO ACEPTACION DE OFERTA	2026-03-05 20:36:32.893252
4385	\N	128	CERTIFICADO DE REGISTRO EN BLACKBOX	2026-03-05 20:36:32.89445
4386	\N	128	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:32.895777
4387	\N	128	GARANTIAS	2026-03-05 20:36:32.898376
4388	\N	128	APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.900221
4389	\N	128	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:32.901615
4390	\N	128	ACTA DE INICIO	2026-03-05 20:36:32.90281
4391	\N	128	FACTURA DEL CONTRATISTA	2026-03-05 20:36:32.904075
4392	\N	128	SOPORTES INGRESO A ALMACEN	2026-03-05 20:36:32.906114
4393	\N	128	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:32.907494
4394	\N	128	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:32.908761
4395	\N	128	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.910078
4396	\N	128	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:32.911534
4397	\N	128	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:32.913036
4398	\N	128	MINUTA DE MODIFICACION	2026-03-05 20:36:32.915509
4399	\N	128	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:32.916654
4400	\N	128	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:32.917757
4401	\N	128	GARANTIAS	2026-03-05 20:36:32.918847
4402	\N	128	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:32.919903
4403	\N	128	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:32.920963
4404	\N	128	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:32.922035
4405	\N	128	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:32.92306
4406	\N	128	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:32.924095
4407	\N	128	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:32.925588
4408	\N	128	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:32.926912
4409	\N	128	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:32.928107
4410	\N	128	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:32.929333
4411	\N	128	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:32.931598
4412	\N	128	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:32.932934
4413	\N	128	ESTUDIOS PREVIOS	2026-03-05 20:36:32.934174
4414	\N	128	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:32.935256
4415	\N	128	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL	2026-03-05 20:36:32.936294
4416	\N	128	ALMACEN	2026-03-05 20:36:32.937842
4417	\N	128	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:32.939336
4418	\N	128	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:32.940795
4419	\N	128	ANALISIS SECTOR	2026-03-05 20:36:32.942089
4420	\N	128	MATRIZ DE RIESGOS	2026-03-05 20:36:32.943846
4421	\N	128	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:32.946097
4422	\N	128	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:32.948592
4423	\N	128	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:32.949915
4424	\N	128	NUMERACION DEL PROCESO	2026-03-05 20:36:32.951117
4425	\N	128	AVISO DE CONVOCATORIA	2026-03-05 20:36:32.952323
4426	\N	128	PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:32.954258
4427	\N	128	ANEXO AL PROYECTO DE PLIEGO	2026-03-05 20:36:32.95559
4428	\N	128	OBSERVACIONES AL PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:32.956861
4429	\N	128	RESPUESTAS A LAS OBSERVACIONES DEL PROYECTO PLIEGOS DE CONDICIONES	2026-03-05 20:36:32.958205
4430	\N	128	RESOLUCION DE APERTURA	2026-03-05 20:36:32.959684
4431	\N	128	RESOLUCION DE REVOCATORIA DEL ACTO QUE ORDENA LA APERTURA	2026-03-05 20:36:32.961579
4432	\N	128	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:32.963743
4433	\N	128	PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:32.99754
4434	\N	128	ANEXO AL PLIEGO DEFINITIVO	2026-03-05 20:36:33.021874
4435	\N	128	OBSERVACIONES AL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:33.023167
4436	\N	128	RESPUESTAS A LAS OBSERVACIONES DEL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:33.024335
4437	\N	128	ADENDAS	2026-03-05 20:36:33.026324
4438	\N	128	ACTO ADMINISTRATIVO DE REVOCATORIA DEL PROCESO	2026-03-05 20:36:33.027676
4439	\N	128	CONSTANCIA DE PUBLICACION DE LISTA DE OFERENTES SECOP II	2026-03-05 20:36:33.028732
4440	\N	128	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:33.029904
4441	\N	128	INFORME DE EVALUACION PRELIMINAR DE REQUISITOS HABILITANTES	2026-03-05 20:36:33.03213
4442	\N	128	CONSOLIDADO INFORME PRELIMINAR	2026-03-05 20:36:33.034337
4443	\N	128	CONSTANCIA PUBLICACION EN SECOP II LISTA DE OFERTAS	2026-03-05 20:36:33.035888
4444	\N	128	RECIBIDAS	2026-03-05 20:36:33.037371
4445	\N	128	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.038423
4446	\N	128	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.03946
4447	\N	128	INFORME DEFINITIVO DE REQUISITOS HABILITANTES	2026-03-05 20:36:33.040466
4448	\N	128	EVENTO DE SUBASTA INVERSA / APERTURA DE SOBRE ECONOMICO	2026-03-05 20:36:33.042378
4449	\N	128	ACTA DE AUDIENCIA DE SUBASTA O INFORME DE SUBASTA	2026-03-05 20:36:33.043647
4450	\N	128	ELECTRONICA	2026-03-05 20:36:33.044863
4451	\N	128	DOCUMENTO DE RECOMENDACION DEL COMITE EVALUADOR	2026-03-05 20:36:33.045942
4452	\N	128	RESOLUCION DE ADJUDICACION O DECLARATORIA DESIERTA	2026-03-05 20:36:33.048478
4453	\N	128	MINUTA ELECTRONICA DEL CONTRATO	2026-03-05 20:36:33.050687
4454	\N	128	ANEXO AL CONTRATO	2026-03-05 20:36:33.052628
4455	\N	128	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.054095
4456	\N	128	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.055612
4457	\N	128	GARANTIAS	2026-03-05 20:36:33.057352
4458	\N	128	APROBACION DE LA GARANTIAS	2026-03-05 20:36:33.058987
4459	\N	128	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:33.060462
4460	\N	128	ACTA DE INICIO	2026-03-05 20:36:33.061665
4461	\N	128	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.062963
4462	\N	128	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:33.065255
4463	\N	128	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:33.06687
4464	\N	128	SOPORTE INGRESO A ALMACEN	2026-03-05 20:36:33.068104
4465	\N	128	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:33.069209
4466	\N	128	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.070251
4467	\N	128	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:33.071357
4468	\N	128	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.072457
4469	\N	128	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:33.074197
4470	\N	128	MINUTA DE MODIFICACION	2026-03-05 20:36:33.075511
4471	\N	128	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.0766
4472	\N	128	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:33.077657
4473	\N	128	GARANTIAS	2026-03-05 20:36:33.07868
4474	\N	128	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.07979
4475	\N	128	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.081984
4476	\N	128	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:33.083464
4477	\N	128	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:33.084656
4478	\N	128	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:33.085718
4479	\N	128	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:33.086758
4480	\N	128	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:33.087786
4481	\N	128	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:33.08888
4482	\N	128	CONSTANCIA DE PUBLICACION EN SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:33.090394
4483	\N	129	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:33.092113
4484	\N	129	ESTUDIOS PREVIOS	2026-03-05 20:36:33.093298
4485	\N	129	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:33.094401
4486	\N	129	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:33.095779
4487	\N	129	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:33.098565
4488	\N	129	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:33.100214
4489	\N	129	ANALISIS SECTOR	2026-03-05 20:36:33.101431
4490	\N	129	MATRIZ DE RIESGOS	2026-03-05 20:36:33.102601
4491	\N	129	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.103954
4492	\N	129	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:33.105693
4493	\N	129	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:33.107408
4494	\N	129	ACTA DE COMITE DE CONTRATACION NUMERACION PARA CONTRATACION DIRECTA	2026-03-05 20:36:33.108856
4495	\N	129	FICHA TECNICA DE NEGOCIACION PROVISIONAL	2026-03-05 20:36:33.110133
4496	\N	129	CERTIFICACION DE EXCLUSIVIDAD Y UNICO OFERENTE EN EL MERCADO DEL BIEN O SERVICIO O (APLICA A CONTRATOS EN LOS CUALES NO EXISTA PLURALIDAD DE OFERENTES)	2026-03-05 20:36:33.111321
4497	\N	129	DOCUMENTO DE CONDICIONES ESPECIALES PROVISIONAL	2026-03-05 20:36:33.112521
4498	\N	129	RESOLUCION DE APERTURA	2026-03-05 20:36:33.115066
4499	\N	129	CARTA DE INTENCION	2026-03-05 20:36:33.116584
4500	\N	129	BOLETIN INFORMATIVO	2026-03-05 20:36:33.117783
4501	\N	129	ACTA RUEDA DE SELECCION DE SOCIEDAD COMISIONISTA	2026-03-05 20:36:33.119101
4502	\N	129	OFICIO INFORMATIVO SELECCION DE LA FIRMA COMISIONISTA	2026-03-05 20:36:33.120188
4503	\N	129	SOLICITUD DE DOCUMENTOS PARA ELABORACION CONTRATO DE COMPRAVENTA	2026-03-05 20:36:33.121714
4504	\N	129	PROPUESTA TECNICA Y CERTIFICACIONES DE CONTRATOS EJECUTADOS	2026-03-05 20:36:33.123393
4505	\N	129	CERTIFICADO DE EXISTENCIA Y REPRESENTACION LEGAL DEL CONTRATISTA	2026-03-05 20:36:33.124732
4506	\N	129	ESTATUTOS DE LA PERSONA JURIDICA	2026-03-05 20:36:33.125889
4507	\N	129	AUTORIZACION AL REPRESENTANTE LEGAL PARA SUSCRIBIR CONTRATOS	2026-03-05 20:36:33.126949
4508	\N	129	HOJA DE VIDA DEL DAFP DE LA PERSONA JURIDICA O PERSONA NATURAL	2026-03-05 20:36:33.128028
4509	\N	129	REGISTRO UNICO TRIBUTARIO - RUT	2026-03-05 20:36:33.129741
4510	\N	129	REGISTRO DE INFORMACION TRIBUTARIA	2026-03-05 20:36:33.131935
4511	\N	129	CEDULA DE CIUDADANIA DEL REPRESENTANTE LEGAL DE LA PERSONA JURIDICA O DOCUMENTO DE IDENTIDAD DE LA PERSONA NATURAL	2026-03-05 20:36:33.133035
4512	\N	129	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DISCIPLINARIOS DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:33.134131
4513	\N	129	CERTIFICADO INEXISTENCIA DE ANTECEDENTES FISCALES DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:33.135166
4514	\N	129	CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTANTE LEGAL O DE LA PERSONA NATURAL	2026-03-05 20:36:33.136207
4515	\N	129	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DEL SISTEMA	2026-03-05 20:36:33.137679
4516	\N	129	REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS RNMC	2026-03-05 20:36:33.139182
4517	\N	129	REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM	2026-03-05 20:36:33.140255
4518	\N	129	CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE EDAD	2026-03-05 20:36:33.141428
4519	\N	129	CERTIFICADO DE PAGO DE APORTES PARAFISCALES	2026-03-05 20:36:33.142627
4520	\N	129	CERTIFICACION BANCARIA NO SUPERIOR A 30 DIAS.	2026-03-05 20:36:33.143715
4521	\N	129	ACTO DE JUSTIFICACION DE LA CONTRATACION DIRECTA	2026-03-05 20:36:33.145262
4522	\N	129	MINUTA ELECTRONICA DE CONTRATO	2026-03-05 20:36:33.147927
4523	\N	129	MINUTA DE CONTRATO	2026-03-05 20:36:33.149598
4524	\N	129	DOCUMENTOS DEL COMISIONISTA	2026-03-05 20:36:33.150808
4525	\N	129	CONSOLIDADO DE OBSERVACIONES	2026-03-05 20:36:33.151969
4526	\N	129	CONTRATO DE COMISION	2026-03-05 20:36:33.153775
4527	\N	129	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.155303
4528	\N	129	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:33.156692
4529	\N	129	GARANTIAS	2026-03-05 20:36:33.158128
4530	\N	129	APROBACION DE LA GARANTIAS	2026-03-05 20:36:33.159487
4531	\N	129	DOCUMENTOS DE DESIGNACION DE SUPERVISOR	2026-03-05 20:36:33.160739
4532	\N	129	ACTA DE INICIO	2026-03-05 20:36:33.163027
4533	\N	129	CONSOLIDADO DE RESPUESTAS A OBSERVACIONES	2026-03-05 20:36:33.165205
4534	\N	129	BOLETIN INFORMATIVO	2026-03-05 20:36:33.166598
4535	\N	129	ANEXOS AL BOLETIN	2026-03-05 20:36:33.168021
4536	\N	129	FICHA TECNICA DE NEGOCIACION DEFINITIVA	2026-03-05 20:36:33.170094
4537	\N	129	DOCUMENTO DE CONDICIONES ESPECIALES DEFINITIVO	2026-03-05 20:36:33.171542
4538	\N	129	DOCUMENTOS DEL PROVEEDOR SELECCIONADO	2026-03-05 20:36:33.172669
4539	\N	129	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:33.173737
4540	\N	129	PROPUESTA Y DOCUMENTOS PROVEEDOR SELECCIONADO	2026-03-05 20:36:33.174818
4541	\N	129	BOLETIN INFORMATIVO Y SOPORTES	2026-03-05 20:36:33.175864
4542	\N	129	INFORME DE RUEDA DE NEGOCIACION DE LA OPERACION	2026-03-05 20:36:33.177391
4543	\N	129	OPERACION DE MERCADO ABIERTO	2026-03-05 20:36:33.17897
4544	\N	129	BOLETA DE NEGOCIACION	2026-03-05 20:36:33.180156
4545	\N	129	SOLICITUD DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.182145
4546	\N	129	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.183417
4547	\N	129	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.184548
4548	\N	129	GARANTIA DEL PROVEEDOR	2026-03-05 20:36:33.186091
4549	\N	129	APROBACION DE LA GARANTIA DEL PROVEEDOR	2026-03-05 20:36:33.187206
4550	\N	129	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.188266
4551	\N	129	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:33.189312
4552	\N	129	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:33.190349
4553	\N	129	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.191475
4554	\N	129	MINUTA DE MODIFICACION	2026-03-05 20:36:33.192653
4555	\N	129	GARANTIAS	2026-03-05 20:36:33.194734
4556	\N	129	APROBACION DE LAS GARANTIAS	2026-03-05 20:36:33.196766
4557	\N	129	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.199341
4558	\N	129	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.201263
4559	\N	129	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:33.203619
4560	\N	129	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:33.205611
4561	\N	129	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.207542
4562	\N	129	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:33.209604
4563	\N	129	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.211621
4564	\N	129	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:33.213644
4565	\N	129	MINUTA DE MODIFICACION	2026-03-05 20:36:33.216554
4566	\N	129	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.219439
4567	\N	129	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.22105
4568	\N	129	GARANTIAS	2026-03-05 20:36:33.222606
4569	\N	129	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.224425
4570	\N	129	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.226105
4571	\N	129	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:33.227654
4572	\N	129	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:33.229489
4573	\N	129	ACTA DE RECIBO A SATISFACCION	2026-03-05 20:36:33.231471
4574	\N	129	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:33.232888
4575	\N	129	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:33.234475
4576	\N	129	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:33.235634
4577	\N	129	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:33.236725
4578	\N	129	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:33.237791
4579	\N	129	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:33.23887
4580	\N	129	ESTUDIOS PREVIOS	2026-03-05 20:36:33.239926
4581	\N	129	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:33.241164
4582	\N	129	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:33.242952
4583	\N	129	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:33.244162
4584	\N	129	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:33.245302
4585	\N	129	ANALISIS SECTOR	2026-03-05 20:36:33.246435
4586	\N	129	MATRIZ DE RIESGOS	2026-03-05 20:36:33.248885
4587	\N	129	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.250814
4588	\N	129	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:33.252277
4589	\N	129	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:33.254235
4590	\N	129	NUMERACION DEL PROCESO DE MINIMA CUANTIA	2026-03-05 20:36:33.25558
4591	\N	129	INVITACION PUBLICA	2026-03-05 20:36:33.257203
4592	\N	129	DOCUMENTO ANEXO A LA INVITACION	2026-03-05 20:36:33.259375
4593	\N	129	OBSERVACIONES A LA INVITACION PUBLICA	2026-03-05 20:36:33.260697
4594	\N	129	RESPUESTAS A LAS OBSERVACIONES DE LA INVITACION PUBLICA	2026-03-05 20:36:33.261942
4595	\N	129	CONSTANCIA DE CIERRE	2026-03-05 20:36:33.263265
4596	\N	129	ADENDAS	2026-03-05 20:36:33.265717
4597	\N	129	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:33.267276
4598	\N	129	INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:33.268482
4599	\N	129	CONSOLIDADO INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:33.269829
4600	\N	129	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.271024
4601	\N	129	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.272206
4602	\N	129	INFORME DE EVALUACION FINAL REQUISITOS HABILITANTES	2026-03-05 20:36:33.274088
4603	\N	129	RECOMENDACION COMITE EVALUADOR	2026-03-05 20:36:33.275545
4604	\N	129	RESOLUCION DE DECLARATORIA DESIERTA	2026-03-05 20:36:33.276766
4605	\N	129	ACEPTACION DE OFERTA	2026-03-05 20:36:33.277893
4606	\N	129	DOCUMENTO ANEXO ACEPTACION DE OFERTA	2026-03-05 20:36:33.278936
4607	\N	129	CERTIFICADO DE REGISTRO EN BLACKBOX	2026-03-05 20:36:33.279991
4608	\N	129	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.282066
4609	\N	129	GARANTIAS	2026-03-05 20:36:33.283499
4610	\N	129	APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.284613
4611	\N	129	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:33.285647
4612	\N	129	ACTA DE INICIO	2026-03-05 20:36:33.286716
4613	\N	129	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.287783
4614	\N	129	SOPORTES INGRESO A ALMACEN	2026-03-05 20:36:33.288891
4615	\N	129	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:33.290843
4616	\N	129	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.292205
4617	\N	129	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.293453
4618	\N	129	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:33.294684
4619	\N	129	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:33.295909
4620	\N	129	MINUTA DE MODIFICACION	2026-03-05 20:36:33.29771
4621	\N	129	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.299484
4622	\N	129	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:33.300896
4623	\N	129	GARANTIAS	2026-03-05 20:36:33.302486
4624	\N	129	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.30394
4625	\N	129	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.30567
4626	\N	129	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:33.30748
4627	\N	129	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:33.308915
4628	\N	129	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:33.310143
4629	\N	129	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:33.311334
4630	\N	129	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:33.312579
4631	\N	129	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:33.315572
4632	\N	129	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:33.317154
4633	\N	129	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:33.318664
4634	\N	129	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:33.320159
4635	\N	129	ESTUDIOS PREVIOS	2026-03-05 20:36:33.32236
4636	\N	129	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:33.323897
4637	\N	129	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL	2026-03-05 20:36:33.325123
4638	\N	129	ALMACEN	2026-03-05 20:36:33.326193
4639	\N	129	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:33.327243
4640	\N	129	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:33.328281
4641	\N	129	ANALISIS SECTOR	2026-03-05 20:36:33.329843
4642	\N	129	MATRIZ DE RIESGOS	2026-03-05 20:36:33.331973
4643	\N	129	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.333087
4644	\N	129	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:33.33428
4645	\N	129	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:33.336007
4646	\N	129	NUMERACION DEL PROCESO	2026-03-05 20:36:33.337499
4647	\N	129	AVISO DE CONVOCATORIA	2026-03-05 20:36:33.338658
4648	\N	129	PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:33.339694
4649	\N	129	ANEXO AL PROYECTO DE PLIEGO	2026-03-05 20:36:33.340721
4650	\N	129	OBSERVACIONES AL PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:33.341986
4651	\N	129	RESPUESTAS A LAS OBSERVACIONES DEL PROYECTO PLIEGOS DE CONDICIONES	2026-03-05 20:36:33.343073
4652	\N	129	RESOLUCION DE APERTURA	2026-03-05 20:36:33.344152
4653	\N	129	RESOLUCION DE REVOCATORIA DEL ACTO QUE ORDENA LA APERTURA	2026-03-05 20:36:33.345269
4654	\N	129	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:33.346293
4655	\N	129	PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:33.348291
4656	\N	129	ANEXO AL PLIEGO DEFINITIVO	2026-03-05 20:36:33.349475
4657	\N	129	OBSERVACIONES AL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:33.350968
4658	\N	129	RESPUESTAS A LAS OBSERVACIONES DEL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:33.35239
4659	\N	129	ADENDAS	2026-03-05 20:36:33.35366
4660	\N	129	ACTO ADMINISTRATIVO DE REVOCATORIA DEL PROCESO	2026-03-05 20:36:33.354852
4661	\N	129	CONSTANCIA DE PUBLICACION DE LISTA DE OFERENTES SECOP II	2026-03-05 20:36:33.356036
4662	\N	129	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:33.357317
4663	\N	129	INFORME DE EVALUACION PRELIMINAR DE REQUISITOS HABILITANTES	2026-03-05 20:36:33.358828
4664	\N	129	CONSOLIDADO INFORME PRELIMINAR	2026-03-05 20:36:33.360068
4665	\N	129	CONSTANCIA PUBLICACION EN SECOP II LISTA DE OFERTAS	2026-03-05 20:36:33.361248
4666	\N	129	RECIBIDAS	2026-03-05 20:36:33.362696
4667	\N	129	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.365205
4668	\N	129	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.36706
4669	\N	129	INFORME DEFINITIVO DE REQUISITOS HABILITANTES	2026-03-05 20:36:33.368431
4670	\N	129	EVENTO DE SUBASTA INVERSA / APERTURA DE SOBRE ECONOMICO	2026-03-05 20:36:33.370443
4671	\N	129	ACTA DE AUDIENCIA DE SUBASTA O INFORME DE SUBASTA	2026-03-05 20:36:33.371924
4672	\N	129	ELECTRONICA	2026-03-05 20:36:33.373105
4673	\N	129	DOCUMENTO DE RECOMENDACION DEL COMITE EVALUADOR	2026-03-05 20:36:33.374245
4674	\N	129	RESOLUCION DE ADJUDICACION O DECLARATORIA DESIERTA	2026-03-05 20:36:33.375349
4675	\N	129	MINUTA ELECTRONICA DEL CONTRATO	2026-03-05 20:36:33.376406
4676	\N	129	ANEXO AL CONTRATO	2026-03-05 20:36:33.378109
4677	\N	129	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.379703
4678	\N	129	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.381529
4679	\N	129	GARANTIAS	2026-03-05 20:36:33.382736
4680	\N	129	APROBACION DE LA GARANTIAS	2026-03-05 20:36:33.383883
4681	\N	129	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:33.385185
4682	\N	129	ACTA DE INICIO	2026-03-05 20:36:33.386858
4683	\N	129	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.388066
4684	\N	129	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:33.389168
4685	\N	129	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:33.390229
4686	\N	129	SOPORTE INGRESO A ALMACEN	2026-03-05 20:36:33.391285
4687	\N	129	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:33.392389
4688	\N	129	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.393823
4689	\N	129	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:33.39512
4690	\N	129	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.396209
4691	\N	129	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:33.398197
4692	\N	129	MINUTA DE MODIFICACION	2026-03-05 20:36:33.400209
4693	\N	129	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.402643
4694	\N	129	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:33.404234
4695	\N	129	GARANTIAS	2026-03-05 20:36:33.4055
4696	\N	129	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.406903
4697	\N	129	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.408326
4698	\N	129	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:33.410673
4699	\N	129	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:33.412306
4700	\N	129	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:33.413793
4701	\N	129	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:33.415976
4702	\N	129	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:33.417983
4703	\N	129	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:33.419702
4704	\N	129	CONSTANCIA DE PUBLICACION EN SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:33.420986
4705	\N	130	PUBLICACION EN EL SECOP DE LA NECESIDAD DE CONTRATACION DENTRO DEL PLAN ANUAL DE ADQUISICION	2026-03-05 20:36:33.422867
4706	\N	130	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL - CDP	2026-03-05 20:36:33.42397
4707	\N	130	ESTUDIO PREVIO	2026-03-05 20:36:33.425564
4708	\N	130	MINUTA CONTRATO	2026-03-05 20:36:33.427122
4709	\N	130	CERTIFICADO DE INEXISTENCIA DE PERSONAL DE PLANTA	2026-03-05 20:36:33.428221
4710	\N	130	CERTIFICADO DE UNICO OFERENTE DEL MERCADO	2026-03-05 20:36:33.429283
4711	\N	130	AUTORIZACION PARA CONTRATOS CON OBJETOS IGUALES (SI APLICA)	2026-03-05 20:36:33.430407
4712	\N	130	AUTORIZACION CONTRATACION DE SERVICIOS PERSONALES	2026-03-05 20:36:33.43231
4713	\N	130	OFERTA DE SERVICIOS PERSONALES RADICADA	2026-03-05 20:36:33.434056
4714	\N	130	HOJA DE VIDA SIGEP	2026-03-05 20:36:33.435323
4715	\N	130	COPIA DOCUMENTO DE IDENTIDAD	2026-03-05 20:36:33.436501
4716	\N	130	ACREDITACION DE SITUACION MILITAR (SI APLICA)	2026-03-05 20:36:33.437561
4717	\N	130	DECLARACION DE BIENES Y RENTAS Y CONFLICTO DE INTERES	2026-03-05 20:36:33.438651
4718	\N	130	CERTIFICADOS ACADEMICOS	2026-03-05 20:36:33.439778
4719	\N	130	CERTIFICADOS DE EXPERIENCIA LABORAL	2026-03-05 20:36:33.44083
4720	\N	130	COPIA DEL REGISTRO DE UNICO TRIBUTARIO	2026-03-05 20:36:33.442637
4721	\N	130	COPIA DEL REGISTRO DE INFORMACION TRIBUTARIA	2026-03-05 20:36:33.443861
4722	\N	130	CERTIFICADO DE INEXISTENCIA DE ANTECEDENTES DEL SISTEMA REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS RNMC	2026-03-05 20:36:33.445595
4723	\N	130	REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM	2026-03-05 20:36:33.447134
4724	\N	130	CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE EDAD	2026-03-05 20:36:33.448957
4725	\N	130	CERTIFICADOS SEGURIDAD SOCIAL Y PARAFISCALES	2026-03-05 20:36:33.450664
4726	\N	130	TARJETA PROFESIONAL O CERTIFICADO DE REGISTRO O MATRICULA PARA PROFESIONES REGULADAS (SI APLICA)	2026-03-05 20:36:33.452123
4727	\N	130	CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS DE LA PROFESION	2026-03-05 20:36:33.453735
4728	\N	130	CERTIFICADO DE ANTECEDENTES DISCIPLINARIOS (PROCURADURIA)	2026-03-05 20:36:33.455135
4729	\N	130	CERTIFICADO DE ANTECEDENTES FISCALES	2026-03-05 20:36:33.456482
4730	\N	130	CERTIFICADO DE ANTECEDENTES JUDICIALES	2026-03-05 20:36:33.458499
4731	\N	130	REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS	2026-03-05 20:36:33.460046
4732	\N	130	AUTORIZACION DE CONSULTA EN BASES DE DATOS SENSIBLES	2026-03-05 20:36:33.461278
4733	\N	130	CERTIFICADO DE INHABILIDADES POR DELITOS SEXUALES	2026-03-05 20:36:33.462841
4734	\N	130	CERTIFICADO REGISTRO DEUDORES ALIMENTARIOS MOROSOS	2026-03-05 20:36:33.465883
4735	\N	130	CERTIFICACION BANCARIA	2026-03-05 20:36:33.467607
4736	\N	130	CERTIFICACION DE INSCRIPCION A LA AGENCIA PUBLICA DE EMPLEO	2026-03-05 20:36:33.468944
4737	\N	130	REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.470158
4738	\N	130	POLIZAS DE GARANTIAS	2026-03-05 20:36:33.471412
4739	\N	130	GESTION CONTRACTUAL PERIODICA DE PRESTACION DE SERVICIOS PERSONALES Y APOYO A LA GESTION	2026-03-05 20:36:33.472579
4740	\N	130	GESTION FINANCIERA PERIODICA DE PRESTACION DE SERVICIOS PERSONALES Y APOYO A LA GESTION FINANCIERA	2026-03-05 20:36:33.474561
4741	\N	130	CERTIFICADO DE PAGO PLANILLA SEGURIDAD SOCIAL Y PARAFISCALES	2026-03-05 20:36:33.475808
4742	\N	130	FACTURA ELECTRONICA	2026-03-05 20:36:33.476878
4743	\N	130	REPORTE REGIMEN TRIBUTARIO	2026-03-05 20:36:33.477927
4744	\N	130	MODIFICACIONES U OTROSI CESION, SUSPENSION, ADICION, PRORROGA, TERMINACION ANTICIPADA, MODIFICACION Y ACLARACION	2026-03-05 20:36:33.479216
4745	\N	130	AL CONTRATO	2026-03-05 20:36:33.480291
4746	\N	130	INFORME FINAL DE SUPERVISION CONTRATACION DE SERVICIOS	2026-03-05 20:36:33.482629
4747	\N	130	PERSONALES Y APOYO A LA GESTION	2026-03-05 20:36:33.483891
4748	\N	130	RELACION DE PAGOS - SIIF	2026-03-05 20:36:33.484992
4749	\N	130	RELACION DE ENTREGA DE BIENES A CONTRATISTA	2026-03-05 20:36:33.486039
4750	\N	130	ACTA DE LIQUIDACION	2026-03-05 20:36:33.487078
4751	\N	131	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:33.488798
4752	\N	131	ESTUDIOS PREVIOS	2026-03-05 20:36:33.490716
4753	\N	131	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:33.491896
4754	\N	131	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:33.492957
4755	\N	131	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:33.494016
4756	\N	131	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:33.495087
4757	\N	131	ANALISIS SECTOR	2026-03-05 20:36:33.49613
4758	\N	131	MATRIZ DE RIESGOS	2026-03-05 20:36:33.498281
4759	\N	131	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.499891
4760	\N	131	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:33.501199
4761	\N	131	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:33.50284
4762	\N	131	ACTA DE COMITE DE CONTRATACION NUMERACION PARA CONTRATACION DIRECTA	2026-03-05 20:36:33.504284
4763	\N	131	FICHA TECNICA DE NEGOCIACION PROVISIONAL	2026-03-05 20:36:33.506264
4764	\N	131	CERTIFICACION DE EXCLUSIVIDAD Y UNICO OFERENTE EN EL MERCADO DEL BIEN O SERVICIO O (APLICA A CONTRATOS EN LOS CUALES NO EXISTA PLURALIDAD DE OFERENTES)	2026-03-05 20:36:33.507723
4765	\N	131	DOCUMENTO DE CONDICIONES ESPECIALES PROVISIONAL	2026-03-05 20:36:33.509218
4766	\N	131	RESOLUCION DE APERTURA	2026-03-05 20:36:33.511162
4767	\N	131	CARTA DE INTENCION	2026-03-05 20:36:33.51242
4768	\N	131	BOLETIN INFORMATIVO	2026-03-05 20:36:33.515365
4769	\N	131	ACTA RUEDA DE SELECCION DE SOCIEDAD COMISIONISTA	2026-03-05 20:36:33.516735
4770	\N	131	OFICIO INFORMATIVO SELECCION DE LA FIRMA COMISIONISTA	2026-03-05 20:36:33.517925
4771	\N	131	SOLICITUD DE DOCUMENTOS PARA ELABORACION CONTRATO DE COMPRAVENTA	2026-03-05 20:36:33.519114
4772	\N	131	PROPUESTA TECNICA Y CERTIFICACIONES DE CONTRATOS EJECUTADOS	2026-03-05 20:36:33.520322
4773	\N	131	CERTIFICADO DE EXISTENCIA Y REPRESENTACION LEGAL DEL CONTRATISTA	2026-03-05 20:36:33.521745
4774	\N	131	ESTATUTOS DE LA PERSONA JURIDICA	2026-03-05 20:36:33.522957
4775	\N	131	AUTORIZACION AL REPRESENTANTE LEGAL PARA SUSCRIBIR CONTRATOS	2026-03-05 20:36:33.5241
4776	\N	131	HOJA DE VIDA DEL DAFP DE LA PERSONA JURIDICA O PERSONA NATURAL	2026-03-05 20:36:33.525198
4777	\N	131	REGISTRO UNICO TRIBUTARIO - RUT	2026-03-05 20:36:33.526282
4778	\N	131	REGISTRO DE INFORMACION TRIBUTARIA	2026-03-05 20:36:33.527354
4779	\N	131	CEDULA DE CIUDADANIA DEL REPRESENTANTE LEGAL DE LA PERSONA JURIDICA O DOCUMENTO DE IDENTIDAD DE LA PERSONA NATURAL	2026-03-05 20:36:33.528459
4780	\N	131	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DISCIPLINARIOS DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:33.530692
4781	\N	131	CERTIFICADO INEXISTENCIA DE ANTECEDENTES FISCALES DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:33.532229
4782	\N	131	CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTANTE LEGAL O DE LA PERSONA NATURAL	2026-03-05 20:36:33.533312
4783	\N	131	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DEL SISTEMA	2026-03-05 20:36:33.534434
4784	\N	131	REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS RNMC	2026-03-05 20:36:33.535498
4785	\N	131	REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM	2026-03-05 20:36:33.536573
4786	\N	131	CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE EDAD	2026-03-05 20:36:33.538431
4787	\N	131	CERTIFICADO DE PAGO DE APORTES PARAFISCALES	2026-03-05 20:36:33.539607
4788	\N	131	CERTIFICACION BANCARIA NO SUPERIOR A 30 DIAS.	2026-03-05 20:36:33.540676
4789	\N	131	ACTO DE JUSTIFICACION DE LA CONTRATACION DIRECTA	2026-03-05 20:36:33.541794
4790	\N	131	MINUTA ELECTRONICA DE CONTRATO	2026-03-05 20:36:33.542899
4791	\N	131	MINUTA DE CONTRATO	2026-03-05 20:36:33.543932
4792	\N	131	DOCUMENTOS DEL COMISIONISTA	2026-03-05 20:36:33.545301
4793	\N	131	CONSOLIDADO DE OBSERVACIONES	2026-03-05 20:36:33.547318
4794	\N	131	CONTRATO DE COMISION	2026-03-05 20:36:33.548918
4795	\N	131	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.55
4796	\N	131	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:33.551558
4797	\N	131	GARANTIAS	2026-03-05 20:36:33.55321
4798	\N	131	APROBACION DE LA GARANTIAS	2026-03-05 20:36:33.554612
4799	\N	131	DOCUMENTOS DE DESIGNACION DE SUPERVISOR	2026-03-05 20:36:33.55593
4800	\N	131	ACTA DE INICIO	2026-03-05 20:36:33.557186
4801	\N	131	CONSOLIDADO DE RESPUESTAS A OBSERVACIONES	2026-03-05 20:36:33.558502
4802	\N	131	BOLETIN INFORMATIVO	2026-03-05 20:36:33.559762
4803	\N	131	ANEXOS AL BOLETIN	2026-03-05 20:36:33.561588
4804	\N	131	FICHA TECNICA DE NEGOCIACION DEFINITIVA	2026-03-05 20:36:33.563389
4805	\N	131	DOCUMENTO DE CONDICIONES ESPECIALES DEFINITIVO	2026-03-05 20:36:33.565652
4806	\N	131	DOCUMENTOS DEL PROVEEDOR SELECCIONADO	2026-03-05 20:36:33.56691
4807	\N	131	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:33.568115
4808	\N	131	PROPUESTA Y DOCUMENTOS PROVEEDOR SELECCIONADO	2026-03-05 20:36:33.569988
4809	\N	131	BOLETIN INFORMATIVO Y SOPORTES	2026-03-05 20:36:33.571456
4810	\N	131	INFORME DE RUEDA DE NEGOCIACION DE LA OPERACION	2026-03-05 20:36:33.572572
4811	\N	131	OPERACION DE MERCADO ABIERTO	2026-03-05 20:36:33.573624
4812	\N	131	BOLETA DE NEGOCIACION	2026-03-05 20:36:33.574965
4813	\N	131	SOLICITUD DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.576024
4814	\N	131	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.577226
4815	\N	131	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.578331
4816	\N	131	GARANTIA DEL PROVEEDOR	2026-03-05 20:36:33.579369
4817	\N	131	APROBACION DE LA GARANTIA DEL PROVEEDOR	2026-03-05 20:36:33.580475
4818	\N	131	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.582228
4819	\N	131	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:33.583322
4820	\N	131	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:33.584424
4821	\N	131	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.585474
4822	\N	131	MINUTA DE MODIFICACION	2026-03-05 20:36:33.586563
4823	\N	131	GARANTIAS	2026-03-05 20:36:33.587628
4824	\N	131	APROBACION DE LAS GARANTIAS	2026-03-05 20:36:33.588663
4825	\N	131	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.589748
4826	\N	131	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.590955
4827	\N	131	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:33.592316
4828	\N	131	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:33.593503
4829	\N	131	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.595083
4830	\N	131	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:33.596974
4831	\N	131	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.598916
4832	\N	131	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:33.600305
4833	\N	131	MINUTA DE MODIFICACION	2026-03-05 20:36:33.601494
4834	\N	131	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.602673
4835	\N	131	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.603926
4836	\N	131	GARANTIAS	2026-03-05 20:36:33.605174
4837	\N	131	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.606462
4838	\N	131	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.607766
4839	\N	131	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:33.609257
4840	\N	131	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:33.610463
4841	\N	131	ACTA DE RECIBO A SATISFACCION	2026-03-05 20:36:33.611633
4842	\N	131	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:33.61305
4843	\N	131	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:33.615058
4844	\N	131	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:33.616435
4845	\N	131	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:33.617717
4846	\N	131	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:33.618948
4847	\N	131	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:33.620025
4848	\N	131	ESTUDIOS PREVIOS	2026-03-05 20:36:33.621094
4849	\N	131	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:33.62212
4850	\N	131	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:33.623145
4851	\N	131	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:33.624476
4852	\N	131	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:33.625884
4853	\N	131	ANALISIS SECTOR	2026-03-05 20:36:33.627154
4854	\N	131	MATRIZ DE RIESGOS	2026-03-05 20:36:33.628373
4855	\N	131	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.629914
4856	\N	131	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:33.631459
4857	\N	131	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:33.63289
4858	\N	131	NUMERACION DEL PROCESO DE MINIMA CUANTIA	2026-03-05 20:36:33.634175
4859	\N	131	INVITACION PUBLICA	2026-03-05 20:36:33.635252
4860	\N	131	DOCUMENTO ANEXO A LA INVITACION	2026-03-05 20:36:33.636318
4861	\N	131	OBSERVACIONES A LA INVITACION PUBLICA	2026-03-05 20:36:33.637644
4862	\N	131	RESPUESTAS A LAS OBSERVACIONES DE LA INVITACION PUBLICA	2026-03-05 20:36:33.638899
4863	\N	131	CONSTANCIA DE CIERRE	2026-03-05 20:36:33.63994
4864	\N	131	ADENDAS	2026-03-05 20:36:33.640962
4865	\N	131	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:33.642472
4866	\N	131	INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:33.644438
4867	\N	131	CONSOLIDADO INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:33.645927
4868	\N	131	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.647701
4869	\N	131	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.649304
4870	\N	131	INFORME DE EVALUACION FINAL REQUISITOS HABILITANTES	2026-03-05 20:36:33.650717
4871	\N	131	RECOMENDACION COMITE EVALUADOR	2026-03-05 20:36:33.652007
4872	\N	131	RESOLUCION DE DECLARATORIA DESIERTA	2026-03-05 20:36:33.653359
4873	\N	131	ACEPTACION DE OFERTA	2026-03-05 20:36:33.654811
4874	\N	131	DOCUMENTO ANEXO ACEPTACION DE OFERTA	2026-03-05 20:36:33.656343
4875	\N	131	CERTIFICADO DE REGISTRO EN BLACKBOX	2026-03-05 20:36:33.657703
4876	\N	131	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.659148
4877	\N	131	GARANTIAS	2026-03-05 20:36:33.66085
4878	\N	131	APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.662284
4879	\N	131	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:33.663762
4880	\N	131	ACTA DE INICIO	2026-03-05 20:36:33.665514
4881	\N	131	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.666856
4882	\N	131	SOPORTES INGRESO A ALMACEN	2026-03-05 20:36:33.667907
4883	\N	131	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:33.668933
4884	\N	131	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.669957
4885	\N	131	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.671004
4886	\N	131	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:33.672038
4887	\N	131	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:33.673055
4888	\N	131	MINUTA DE MODIFICACION	2026-03-05 20:36:33.674077
4889	\N	131	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.675258
4890	\N	131	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:33.676766
4891	\N	131	GARANTIAS	2026-03-05 20:36:33.677848
4892	\N	131	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.678894
4893	\N	131	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.679948
4894	\N	131	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:33.681438
4895	\N	131	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:33.682674
4896	\N	131	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:33.683801
4897	\N	131	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:33.684877
4898	\N	131	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:33.686007
4899	\N	131	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:33.687054
4900	\N	131	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:33.688092
4901	\N	131	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:33.689119
4902	\N	131	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:33.690722
4903	\N	131	ESTUDIOS PREVIOS	2026-03-05 20:36:33.692541
4904	\N	131	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:33.693747
4905	\N	131	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL	2026-03-05 20:36:33.69518
4906	\N	131	ALMACEN	2026-03-05 20:36:33.69651
4907	\N	131	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:33.698337
4908	\N	131	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:33.699627
4909	\N	131	ANALISIS SECTOR	2026-03-05 20:36:33.700823
4910	\N	131	MATRIZ DE RIESGOS	2026-03-05 20:36:33.701999
4911	\N	131	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.70333
4912	\N	131	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:33.704722
4913	\N	131	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:33.706052
4914	\N	131	NUMERACION DEL PROCESO	2026-03-05 20:36:33.707795
4915	\N	131	AVISO DE CONVOCATORIA	2026-03-05 20:36:33.709239
4916	\N	131	PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:33.710456
4917	\N	131	ANEXO AL PROYECTO DE PLIEGO	2026-03-05 20:36:33.711572
4918	\N	131	OBSERVACIONES AL PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:33.712735
4919	\N	131	RESPUESTAS A LAS OBSERVACIONES DEL PROYECTO PLIEGOS DE CONDICIONES	2026-03-05 20:36:33.713997
4920	\N	131	RESOLUCION DE APERTURA	2026-03-05 20:36:33.715223
4921	\N	131	RESOLUCION DE REVOCATORIA DEL ACTO QUE ORDENA LA APERTURA	2026-03-05 20:36:33.716325
4922	\N	131	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:33.717455
4923	\N	131	PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:33.718502
4924	\N	131	ANEXO AL PLIEGO DEFINITIVO	2026-03-05 20:36:33.719563
4925	\N	131	OBSERVACIONES AL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:33.720614
4926	\N	131	RESPUESTAS A LAS OBSERVACIONES DEL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:33.721653
4927	\N	131	ADENDAS	2026-03-05 20:36:33.723441
4928	\N	131	ACTO ADMINISTRATIVO DE REVOCATORIA DEL PROCESO	2026-03-05 20:36:33.724734
4929	\N	131	CONSTANCIA DE PUBLICACION DE LISTA DE OFERENTES SECOP II	2026-03-05 20:36:33.725822
4930	\N	131	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:33.726866
4931	\N	131	INFORME DE EVALUACION PRELIMINAR DE REQUISITOS HABILITANTES	2026-03-05 20:36:33.727898
4932	\N	131	CONSOLIDADO INFORME PRELIMINAR	2026-03-05 20:36:33.728973
4933	\N	131	CONSTANCIA PUBLICACION EN SECOP II LISTA DE OFERTAS	2026-03-05 20:36:33.729998
4934	\N	131	RECIBIDAS	2026-03-05 20:36:33.731392
4935	\N	131	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.732604
4936	\N	131	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.733978
4937	\N	131	INFORME DEFINITIVO DE REQUISITOS HABILITANTES	2026-03-05 20:36:33.735493
4938	\N	131	EVENTO DE SUBASTA INVERSA / APERTURA DE SOBRE ECONOMICO	2026-03-05 20:36:33.736726
4939	\N	131	ACTA DE AUDIENCIA DE SUBASTA O INFORME DE SUBASTA	2026-03-05 20:36:33.737905
4940	\N	131	ELECTRONICA	2026-03-05 20:36:33.739616
4941	\N	131	DOCUMENTO DE RECOMENDACION DEL COMITE EVALUADOR	2026-03-05 20:36:33.740844
4942	\N	131	RESOLUCION DE ADJUDICACION O DECLARATORIA DESIERTA	2026-03-05 20:36:33.742232
4943	\N	131	MINUTA ELECTRONICA DEL CONTRATO	2026-03-05 20:36:33.743637
4944	\N	131	ANEXO AL CONTRATO	2026-03-05 20:36:33.745028
4945	\N	131	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.746262
4946	\N	131	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.747999
4947	\N	131	GARANTIAS	2026-03-05 20:36:33.749645
4948	\N	131	APROBACION DE LA GARANTIAS	2026-03-05 20:36:33.75089
4949	\N	131	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:33.752084
4950	\N	131	ACTA DE INICIO	2026-03-05 20:36:33.753531
4951	\N	131	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.755694
4952	\N	131	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:33.757452
4953	\N	131	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:33.758691
4954	\N	131	SOPORTE INGRESO A ALMACEN	2026-03-05 20:36:33.759831
4955	\N	131	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:33.760875
4956	\N	131	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.761905
4957	\N	131	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:33.762979
4958	\N	131	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.764266
4959	\N	131	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:33.765637
4960	\N	131	MINUTA DE MODIFICACION	2026-03-05 20:36:33.766714
4961	\N	131	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.76778
4962	\N	131	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:33.768826
4963	\N	131	GARANTIAS	2026-03-05 20:36:33.770376
4964	\N	131	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.771657
4965	\N	131	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.772769
4966	\N	131	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:33.773807
4967	\N	131	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:33.774901
4968	\N	131	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:33.775949
4969	\N	131	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:33.776981
4970	\N	131	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:33.778023
4971	\N	131	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:33.77933
4972	\N	131	CONSTANCIA DE PUBLICACION EN SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:33.781319
4973	\N	132	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:33.783396
4974	\N	132	ESTUDIOS PREVIOS	2026-03-05 20:36:33.784677
4975	\N	132	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:33.786871
4976	\N	132	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:33.788447
4977	\N	132	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:33.789702
4978	\N	132	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:33.790893
4979	\N	132	ANALISIS SECTOR	2026-03-05 20:36:33.792324
4980	\N	132	MATRIZ DE RIESGOS	2026-03-05 20:36:33.794001
4981	\N	132	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.795468
4982	\N	132	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:33.796934
4983	\N	132	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:33.798943
4984	\N	132	ACTA DE COMITE DE CONTRATACION NUMERACION PARA CONTRATACION DIRECTA	2026-03-05 20:36:33.800457
4985	\N	132	FICHA TECNICA DE NEGOCIACION PROVISIONAL	2026-03-05 20:36:33.801584
4986	\N	132	CERTIFICACION DE EXCLUSIVIDAD Y UNICO OFERENTE EN EL MERCADO DEL BIEN O SERVICIO O (APLICA A CONTRATOS EN LOS CUALES NO EXISTA PLURALIDAD DE OFERENTES)	2026-03-05 20:36:33.802638
4987	\N	132	DOCUMENTO DE CONDICIONES ESPECIALES PROVISIONAL	2026-03-05 20:36:33.803959
4988	\N	132	RESOLUCION DE APERTURA	2026-03-05 20:36:33.805013
4989	\N	132	CARTA DE INTENCION	2026-03-05 20:36:33.80614
4990	\N	132	BOLETIN INFORMATIVO	2026-03-05 20:36:33.807356
4991	\N	132	ACTA RUEDA DE SELECCION DE SOCIEDAD COMISIONISTA	2026-03-05 20:36:33.808435
4992	\N	132	OFICIO INFORMATIVO SELECCION DE LA FIRMA COMISIONISTA	2026-03-05 20:36:33.809496
4993	\N	132	SOLICITUD DE DOCUMENTOS PARA ELABORACION CONTRATO DE COMPRAVENTA	2026-03-05 20:36:33.810522
4994	\N	132	PROPUESTA TECNICA Y CERTIFICACIONES DE CONTRATOS EJECUTADOS	2026-03-05 20:36:33.811545
4995	\N	132	CERTIFICADO DE EXISTENCIA Y REPRESENTACION LEGAL DEL CONTRATISTA	2026-03-05 20:36:33.813001
4996	\N	132	ESTATUTOS DE LA PERSONA JURIDICA	2026-03-05 20:36:33.81499
4997	\N	132	AUTORIZACION AL REPRESENTANTE LEGAL PARA SUSCRIBIR CONTRATOS	2026-03-05 20:36:33.816295
4998	\N	132	HOJA DE VIDA DEL DAFP DE LA PERSONA JURIDICA O PERSONA NATURAL	2026-03-05 20:36:33.81737
4999	\N	132	REGISTRO UNICO TRIBUTARIO - RUT	2026-03-05 20:36:33.818416
5000	\N	132	REGISTRO DE INFORMACION TRIBUTARIA	2026-03-05 20:36:33.819443
5001	\N	132	CEDULA DE CIUDADANIA DEL REPRESENTANTE LEGAL DE LA PERSONA JURIDICA O DOCUMENTO DE IDENTIDAD DE LA PERSONA NATURAL	2026-03-05 20:36:33.820475
5002	\N	132	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DISCIPLINARIOS DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:33.821512
5003	\N	132	CERTIFICADO INEXISTENCIA DE ANTECEDENTES FISCALES DEL REPRESENTANTE LEGAL Y DE LA PERSONA JURIDICA O DE LA PERSONA NATURAL	2026-03-05 20:36:33.822662
5004	\N	132	CERTIFICADO INEXISTENCIA DE ANTECEDENTES JUDICIALES DEL REPRESENTANTE LEGAL O DE LA PERSONA NATURAL	2026-03-05 20:36:33.823852
5005	\N	132	CERTIFICADO INEXISTENCIA DE ANTECEDENTES DEL SISTEMA	2026-03-05 20:36:33.825287
5006	\N	132	REGISTRO NACIONAL DE MEDIDAS CORRECTIVAS RNMC	2026-03-05 20:36:33.827156
5007	\N	132	REGISTRO DE DEUDORES ALIMENTARIOS MOROSOS REDAM	2026-03-05 20:36:33.828475
5008	\N	132	CONSULTA DE INHABILIDADES POR DELITOS SEXUALES CONTRA MENORES DE EDAD	2026-03-05 20:36:33.830376
5009	\N	132	CERTIFICADO DE PAGO DE APORTES PARAFISCALES	2026-03-05 20:36:33.83303
5010	\N	132	CERTIFICACION BANCARIA NO SUPERIOR A 30 DIAS.	2026-03-05 20:36:33.834687
5011	\N	132	ACTO DE JUSTIFICACION DE LA CONTRATACION DIRECTA	2026-03-05 20:36:33.836064
5012	\N	132	MINUTA ELECTRONICA DE CONTRATO	2026-03-05 20:36:33.837403
5013	\N	132	MINUTA DE CONTRATO	2026-03-05 20:36:33.838751
5014	\N	132	DOCUMENTOS DEL COMISIONISTA	2026-03-05 20:36:33.840186
5015	\N	132	CONSOLIDADO DE OBSERVACIONES	2026-03-05 20:36:33.841643
5016	\N	132	CONTRATO DE COMISION	2026-03-05 20:36:33.843016
5017	\N	132	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.844161
5018	\N	132	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:33.845484
5019	\N	132	GARANTIAS	2026-03-05 20:36:33.84657
5020	\N	132	APROBACION DE LA GARANTIAS	2026-03-05 20:36:33.848966
5021	\N	132	DOCUMENTOS DE DESIGNACION DE SUPERVISOR	2026-03-05 20:36:33.851437
5022	\N	132	ACTA DE INICIO	2026-03-05 20:36:33.853251
5023	\N	132	CONSOLIDADO DE RESPUESTAS A OBSERVACIONES	2026-03-05 20:36:33.854463
5024	\N	132	BOLETIN INFORMATIVO	2026-03-05 20:36:33.855639
5025	\N	132	ANEXOS AL BOLETIN	2026-03-05 20:36:33.856737
5026	\N	132	FICHA TECNICA DE NEGOCIACION DEFINITIVA	2026-03-05 20:36:33.85783
5027	\N	132	DOCUMENTO DE CONDICIONES ESPECIALES DEFINITIVO	2026-03-05 20:36:33.858948
5028	\N	132	DOCUMENTOS DEL PROVEEDOR SELECCIONADO	2026-03-05 20:36:33.860145
5029	\N	132	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:33.861183
5030	\N	132	PROPUESTA Y DOCUMENTOS PROVEEDOR SELECCIONADO	2026-03-05 20:36:33.862181
5031	\N	132	BOLETIN INFORMATIVO Y SOPORTES	2026-03-05 20:36:33.863337
5032	\N	132	INFORME DE RUEDA DE NEGOCIACION DE LA OPERACION	2026-03-05 20:36:33.864929
5033	\N	132	OPERACION DE MERCADO ABIERTO	2026-03-05 20:36:33.86647
5034	\N	132	BOLETA DE NEGOCIACION	2026-03-05 20:36:33.86912
5035	\N	132	SOLICITUD DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.871641
5036	\N	132	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.874091
5037	\N	132	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.876161
5038	\N	132	GARANTIA DEL PROVEEDOR	2026-03-05 20:36:33.878179
5039	\N	132	APROBACION DE LA GARANTIA DEL PROVEEDOR	2026-03-05 20:36:33.88022
5040	\N	132	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.883205
5041	\N	132	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:33.884823
5042	\N	132	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:33.886063
5043	\N	132	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.887163
5044	\N	132	MINUTA DE MODIFICACION	2026-03-05 20:36:33.888442
5045	\N	132	GARANTIAS	2026-03-05 20:36:33.889489
5046	\N	132	APROBACION DE LAS GARANTIAS	2026-03-05 20:36:33.890507
5047	\N	132	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.891843
5048	\N	132	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.89323
5049	\N	132	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:33.894639
5050	\N	132	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:33.896027
5051	\N	132	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.898318
5052	\N	132	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:33.900583
5053	\N	132	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.902133
5054	\N	132	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:33.903209
5055	\N	132	MINUTA DE MODIFICACION	2026-03-05 20:36:33.904471
5056	\N	132	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.905444
5057	\N	132	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.906487
5058	\N	132	GARANTIAS	2026-03-05 20:36:33.907518
5059	\N	132	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.908598
5060	\N	132	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.909628
5061	\N	132	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:33.910692
5062	\N	132	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:33.911722
5063	\N	132	ACTA DE RECIBO A SATISFACCION	2026-03-05 20:36:33.91306
5064	\N	132	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:33.915085
5065	\N	132	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:33.916803
5066	\N	132	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:33.918112
5067	\N	132	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:33.919208
5068	\N	132	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:33.920307
5069	\N	132	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:33.922268
5070	\N	132	ESTUDIOS PREVIOS	2026-03-05 20:36:33.923495
5071	\N	132	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:33.924578
5072	\N	132	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL ALMACEN	2026-03-05 20:36:33.925676
5073	\N	132	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:33.927156
5074	\N	132	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:33.928452
5075	\N	132	ANALISIS SECTOR	2026-03-05 20:36:33.929637
5076	\N	132	MATRIZ DE RIESGOS	2026-03-05 20:36:33.931578
5077	\N	132	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.933289
5078	\N	132	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:33.934947
5079	\N	132	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:33.936128
5080	\N	132	NUMERACION DEL PROCESO DE MINIMA CUANTIA	2026-03-05 20:36:33.938429
5081	\N	132	INVITACION PUBLICA	2026-03-05 20:36:33.940505
5082	\N	132	DOCUMENTO ANEXO A LA INVITACION	2026-03-05 20:36:33.942201
5083	\N	132	OBSERVACIONES A LA INVITACION PUBLICA	2026-03-05 20:36:33.943554
5084	\N	132	RESPUESTAS A LAS OBSERVACIONES DE LA INVITACION PUBLICA	2026-03-05 20:36:33.944871
5085	\N	132	CONSTANCIA DE CIERRE	2026-03-05 20:36:33.946125
5086	\N	132	ADENDAS	2026-03-05 20:36:33.948142
5087	\N	132	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:33.949768
5088	\N	132	INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:33.950862
5089	\N	132	CONSOLIDADO INFORME DE EVALUACION PRELIMINAR	2026-03-05 20:36:33.952086
5090	\N	132	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.953079
5091	\N	132	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:33.954138
5092	\N	132	INFORME DE EVALUACION FINAL REQUISITOS HABILITANTES	2026-03-05 20:36:33.956058
5093	\N	132	RECOMENDACION COMITE EVALUADOR	2026-03-05 20:36:33.957394
5094	\N	132	RESOLUCION DE DECLARATORIA DESIERTA	2026-03-05 20:36:33.958463
5095	\N	132	ACEPTACION DE OFERTA	2026-03-05 20:36:33.959536
5096	\N	132	DOCUMENTO ANEXO ACEPTACION DE OFERTA	2026-03-05 20:36:33.960572
5097	\N	132	CERTIFICADO DE REGISTRO EN BLACKBOX	2026-03-05 20:36:33.961809
5098	\N	132	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:33.963834
5099	\N	132	GARANTIAS	2026-03-05 20:36:33.966037
5100	\N	132	APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.967351
5101	\N	132	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:33.968721
5102	\N	132	ACTA DE INICIO	2026-03-05 20:36:33.971021
5103	\N	132	FACTURA DEL CONTRATISTA	2026-03-05 20:36:33.972395
5104	\N	132	SOPORTES INGRESO A ALMACEN	2026-03-05 20:36:33.973437
5105	\N	132	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:33.974461
5106	\N	132	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:33.975493
5107	\N	132	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:33.976569
5108	\N	132	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:33.977913
5109	\N	132	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:33.979175
5110	\N	132	MINUTA DE MODIFICACION	2026-03-05 20:36:33.980583
5111	\N	132	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:33.983636
5112	\N	132	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:33.985147
5113	\N	132	GARANTIAS	2026-03-05 20:36:33.986777
5114	\N	132	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:33.987949
5115	\N	132	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:33.989011
5116	\N	132	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:33.990265
5117	\N	132	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:33.991647
5118	\N	132	CERTIFICACION PAZ Y SALVO REQUERIDOS	2026-03-05 20:36:33.993029
5119	\N	132	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:33.994216
5120	\N	132	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:33.995478
5121	\N	132	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:33.996511
5122	\N	132	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:33.998823
5123	\N	132	CONSTANCIA PUBLICACION SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:34.000099
5124	\N	132	SOLICITUD INICIO DE TRAMITE DE PROCESO CONTRACTUAL	2026-03-05 20:36:34.001202
5125	\N	132	ESTUDIOS PREVIOS	2026-03-05 20:36:34.002189
5126	\N	132	EVIDENCIA DE INCLUSION EN EL PLAN DE ADQUISICIONES	2026-03-05 20:36:34.003221
5127	\N	132	CERTIFICADO DE INEXISTENCIA DE BIENES EXPEDIDO POR EL	2026-03-05 20:36:34.00468
5128	\N	132	ALMACEN	2026-03-05 20:36:34.00637
5129	\N	132	VERIFICACION CRITERIOS DE CONTRATACION	2026-03-05 20:36:34.007418
5130	\N	132	AUTORIZACION O CONCEPTO TECNICO	2026-03-05 20:36:34.00844
5131	\N	132	ANALISIS SECTOR	2026-03-05 20:36:34.009561
5132	\N	132	MATRIZ DE RIESGOS	2026-03-05 20:36:34.010552
5133	\N	132	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:34.011503
5134	\N	132	COMUNICACION DE AUTORIZACION VIGENCIAS FUTURAS DEL MINISTERIO DE HACIENDA	2026-03-05 20:36:34.012591
5135	\N	132	ACTA DE COMITE DE CONTRATACION	2026-03-05 20:36:34.01531
5136	\N	132	NUMERACION DEL PROCESO	2026-03-05 20:36:34.016819
5137	\N	132	AVISO DE CONVOCATORIA	2026-03-05 20:36:34.017961
5138	\N	132	PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:34.018972
5139	\N	132	ANEXO AL PROYECTO DE PLIEGO	2026-03-05 20:36:34.019936
5140	\N	132	OBSERVACIONES AL PROYECTO DE PLIEGO DE CONDICIONES	2026-03-05 20:36:34.02169
5141	\N	132	RESPUESTAS A LAS OBSERVACIONES DEL PROYECTO PLIEGOS DE CONDICIONES	2026-03-05 20:36:34.023205
5142	\N	132	RESOLUCION DE APERTURA	2026-03-05 20:36:34.024327
5143	\N	132	RESOLUCION DE REVOCATORIA DEL ACTO QUE ORDENA LA APERTURA	2026-03-05 20:36:34.026008
5144	\N	132	ESTUDIOS PREVIOS DEFINITIVOS	2026-03-05 20:36:34.027166
5145	\N	132	PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:34.028492
5146	\N	132	ANEXO AL PLIEGO DEFINITIVO	2026-03-05 20:36:34.029817
5147	\N	132	OBSERVACIONES AL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:34.032418
5148	\N	132	RESPUESTAS A LAS OBSERVACIONES DEL PLIEGO DE CONDICIONES DEFINITIVO	2026-03-05 20:36:34.034766
5149	\N	132	ADENDAS	2026-03-05 20:36:34.036864
5150	\N	132	ACTO ADMINISTRATIVO DE REVOCATORIA DEL PROCESO	2026-03-05 20:36:34.039105
5151	\N	132	CONSTANCIA DE PUBLICACION DE LISTA DE OFERENTES SECOP II	2026-03-05 20:36:34.04045
5152	\N	132	DESIGNACION DEL COMITE ASESOR EVALUADOR	2026-03-05 20:36:34.041755
5153	\N	132	INFORME DE EVALUACION PRELIMINAR DE REQUISITOS HABILITANTES	2026-03-05 20:36:34.043175
5154	\N	132	CONSOLIDADO INFORME PRELIMINAR	2026-03-05 20:36:34.044251
5155	\N	132	CONSTANCIA PUBLICACION EN SECOP II LISTA DE OFERTAS	2026-03-05 20:36:34.045508
5156	\N	132	RECIBIDAS	2026-03-05 20:36:34.046722
5157	\N	132	OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:34.04892
5158	\N	132	RESPUESTA A OBSERVACIONES AL INFORME DE EVALUACION	2026-03-05 20:36:34.050145
5159	\N	132	INFORME DEFINITIVO DE REQUISITOS HABILITANTES	2026-03-05 20:36:34.051286
5160	\N	132	EVENTO DE SUBASTA INVERSA / APERTURA DE SOBRE ECONOMICO	2026-03-05 20:36:34.052332
5161	\N	132	ACTA DE AUDIENCIA DE SUBASTA O INFORME DE SUBASTA	2026-03-05 20:36:34.053394
5162	\N	132	ELECTRONICA	2026-03-05 20:36:34.054907
5163	\N	132	DOCUMENTO DE RECOMENDACION DEL COMITE EVALUADOR	2026-03-05 20:36:34.056546
5164	\N	132	RESOLUCION DE ADJUDICACION O DECLARATORIA DESIERTA	2026-03-05 20:36:34.057571
5165	\N	132	MINUTA ELECTRONICA DEL CONTRATO	2026-03-05 20:36:34.058729
5166	\N	132	ANEXO AL CONTRATO	2026-03-05 20:36:34.059967
5167	\N	132	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:34.060939
5168	\N	132	CERTIFICADO DE REGISTRO PRESUPUESTAL	2026-03-05 20:36:34.061885
5169	\N	132	GARANTIAS	2026-03-05 20:36:34.063973
5170	\N	132	APROBACION DE LA GARANTIAS	2026-03-05 20:36:34.065727
5171	\N	132	DESIGNACION DE SUPERVISOR	2026-03-05 20:36:34.06697
5172	\N	132	ACTA DE INICIO	2026-03-05 20:36:34.068094
5173	\N	132	FACTURA DEL CONTRATISTA	2026-03-05 20:36:34.069145
5174	\N	132	INFORMES DE EJECUCION CON SUS SOPORTES	2026-03-05 20:36:34.070278
5175	\N	132	INFORMES Y/O CERTIFICACIONES DE PAGO DE SUPERVISION	2026-03-05 20:36:34.072245
5176	\N	132	SOPORTE INGRESO A ALMACEN	2026-03-05 20:36:34.073458
5177	\N	132	ACTA DE ENTREGA DE PRESTACION Y DESARROLLO DE SERVICIOS	2026-03-05 20:36:34.074982
5178	\N	132	SOLICITUD DE MODIFICACION CON SUS SOPORTES	2026-03-05 20:36:34.076313
5179	\N	132	INFORME DE SUPERVISION PARA MODIFICACION	2026-03-05 20:36:34.077486
5180	\N	132	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL	2026-03-05 20:36:34.078548
5181	\N	132	MINUTA ELECTRONICA DE MODIFICACION	2026-03-05 20:36:34.079714
5182	\N	132	MINUTA DE MODIFICACION	2026-03-05 20:36:34.082106
5183	\N	132	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:34.083791
5184	\N	132	CERTIFICADO DE REGISTRO PRESUPUESTAL - RP	2026-03-05 20:36:34.085318
5185	\N	132	GARANTIAS	2026-03-05 20:36:34.086471
5186	\N	132	CONSTANCIA DE APROBACION DE LA GARANTIAS EN SECOP II	2026-03-05 20:36:34.088524
5187	\N	132	DOCUMENTOS DE EJECUCION	2026-03-05 20:36:34.090029
5188	\N	132	PROCEDIMIENTO DE INCUMPLIMIENTO	2026-03-05 20:36:34.091237
5189	\N	132	INFORME FINAL DE SUPERVISION	2026-03-05 20:36:34.092975
5190	\N	132	ACTA DE RECIBO A SATISFACCION POR PARTE DE LA SUPERVISION	2026-03-05 20:36:34.094093
5191	\N	132	ACTA DE LIQUIDACION O TERMINACION ANTICIPADA	2026-03-05 20:36:34.09526
5192	\N	132	PAGO PENDIENTES A SALDOS A FAVOR DEL CONTRATISTA	2026-03-05 20:36:34.096324
5193	\N	132	ACTA DE CIERRE DE EXPEDIENTE	2026-03-05 20:36:34.09805
5194	\N	132	CONSTANCIA DE PUBLICACION EN SECOP II DEL ACTA DE LIQUIDACION Y/O ACTA DE CIERRE	2026-03-05 20:36:34.099712
5195	86	\N	DERECHO DE PETICION	2026-03-05 20:36:34.101573
5196	86	\N	RESPUESTA A DERECHO DE PETICION	2026-03-05 20:36:34.102608
5197	\N	133	SOLICITUD DE INFORME POR ENTES DE CONTROL Y VIGILANCIA	2026-03-05 20:36:34.105776
5198	\N	133	INFORME	2026-03-05 20:36:34.106856
5199	\N	134	REQUERIMIENTO	2026-03-05 20:36:34.108514
5200	\N	134	INFORME	2026-03-05 20:36:34.109607
5201	\N	135	INFORMES DE GESTION	2026-03-05 20:36:34.11106
5202	\N	135	COMUNICACION DE REMISION DEL INFORME CONSOLIDADO A LA DIRECCION  DE PLANEACION  Y DIRECCIONAMIENTO CORPORATIVO	2026-03-05 20:36:34.112111
5203	88	\N	COMUNICACION SOLICITUD ORDEN DE COMPRA	2026-03-05 20:36:34.114755
5204	88	\N	INSTRUMENTO DE AGREGACION DE DEMANDA	2026-03-05 20:36:34.116089
5205	88	\N	CERTIFICADO DE DISPONIBILIDAD PRESUPUESTAL - CDP	2026-03-05 20:36:34.117057
5206	88	\N	ESTUDIOS PREVIOS	2026-03-05 20:36:34.117935
5207	88	\N	SIMULADOR INSTRUMENTO DE AGREGACION DE DEMANDA - IAD	2026-03-05 20:36:34.118731
5208	88	\N	CONSTANCIA DE SELECCION PROVEEDOR	2026-03-05 20:36:34.119488
5209	88	\N	ORDEN DE COMPRA	2026-03-05 20:36:34.120386
5210	88	\N	CERTIFICADO DE REGISTRO EN LA PLATAFORMA BLACKBOX	2026-03-05 20:36:34.121486
5211	88	\N	CERTIFICADO DE REGISTRO PRESUPUESTAL - PR	2026-03-05 20:36:34.122341
5212	88	\N	FACTURA DE ORDEN DE COMPRA	2026-03-05 20:36:34.123152
5213	88	\N	INFORME DE SEGUIMIENTO A ORDEN DE COMPRA	2026-03-05 20:36:34.123889
5214	88	\N	MODIFICACIONES/ ADICION/ CANCELACION ORDEN DE COMPRA	2026-03-05 20:36:34.12512
5215	88	\N	CERTIFICADO DE PUBLICACION SECOP II	2026-03-05 20:36:34.126182
5216	89	\N	DENUNCIA DE PERDIDA	2026-03-05 20:36:34.12768
5217	89	\N	INFORME AL ORDENADOR DEL GASTO	2026-03-05 20:36:34.12903
5218	89	\N	DESIGNACION DE INVESTIGADOR ADMINISTRATIVO	2026-03-05 20:36:34.130307
5219	89	\N	NOTIFICACION AL ASEGURADOR	2026-03-05 20:36:34.132061
5220	89	\N	INFORME DEL ASEGURADOR	2026-03-05 20:36:34.13311
5221	89	\N	REPOSICION O PAGO DEL BIEN	2026-03-05 20:36:34.134161
5222	89	\N	EVIDENCIA Y SOPORTE DE INVESTIGACION	2026-03-05 20:36:34.135083
5223	89	\N	INFORME RESULTADO DE INVESTIGACION	2026-03-05 20:36:34.136006
5224	89	\N	ACTA DE BAJA DE BIEN	2026-03-05 20:36:34.136983
5225	89	\N	ORDEN DE ARCHIVO DEL EXPEDIENTE	2026-03-05 20:36:34.13789
5226	89	\N	REMISION A CONTROL INTERNO Y/O ENTE DE CONTROL	2026-03-05 20:36:34.138776
5227	90	\N	DOCUMENTOS PRECONTRACTUALES	2026-03-05 20:36:34.140302
5228	90	\N	RESOLUCION POR LA CUAL SE DECLARA DESIERTO EL PROCESO CONTRACTUAL	2026-03-05 20:36:34.141204
5229	90	\N	COMUNICACION DE DECLARACION DE DESIERTO DEL PROCESOS	2026-03-05 20:36:34.142317
5230	90	\N	PUBLICACION DEL ACTO ADMINISTRATIVO EN PORTAL WEB INSTITUCIONAL	2026-03-05 20:36:34.143298
5231	91	\N	DOCUMENTOS PRECONTRACTUALES	2026-03-05 20:36:34.144852
5232	91	\N	RESOLUCION POR LA CUAL SE DECLARA REVOCADO EL PROCESO	2026-03-05 20:36:34.146136
5233	91	\N	COMUNICACION DE DECLARACION DE REVOCATORIA DEL PROCESO	2026-03-05 20:36:34.147209
5234	91	\N	PUBLICACION DEL ACTO ADMINISTRATIVO EN PORTAL WEB INSTITUCIONAL	2026-03-05 20:36:34.148474
5235	\N	136	ACTA DE EQUIPO PEDAGOGICO DE CENTROS - EPC	2026-03-05 20:50:55.061728
5236	93	\N	DERECHO DE PETICION	2026-03-05 20:50:55.092944
5237	93	\N	RESPUESTA A DERECHO DE PETICION	2026-03-05 20:50:55.094408
5238	\N	137	INFORME DE GESTION	2026-03-05 20:50:55.098609
5239	\N	137	COMUNICACION DE REMISION INFORME	2026-03-05 20:50:55.100733
5240	95	\N	PLAN DE TRABAJO PARA ACTUALIZACION DEL LOS PROGRAMAS DE FORMACION	2026-03-05 20:50:55.103893
5241	95	\N	ACTA DE DESIGNACION DE RESPONSABLES	2026-03-05 20:50:55.105108
5242	95	\N	MATRIZ PERFIL DE EGRESO	2026-03-05 20:50:55.106689
5243	95	\N	ACTA VALIDACION INTERNA PERFIL DE EGRESO	2026-03-05 20:50:55.108266
5244	95	\N	ACTA VALIDACION EXTERNA PERFIL DE EGRESO	2026-03-05 20:50:55.109986
5245	95	\N	ACTA DE VALIDACION DEFINITIVA PERFIL DE EGRESO	2026-03-05 20:50:55.111335
5246	95	\N	MATRIZ PERFIL DE INGRESO	2026-03-05 20:50:55.112526
5247	95	\N	DISENO CURRICULAR	2026-03-05 20:50:55.113907
5248	95	\N	ESTADO DEL ARTE DE LA OCUPACION	2026-03-05 20:50:55.115225
5249	95	\N	JUSTIFICACION DEL PROGRAMA	2026-03-05 20:50:55.116407
5250	95	\N	LISTAS MAESTRAS DE MATERIALES	2026-03-05 20:50:55.118087
5251	95	\N	ACTA DE VERIFICACION TECNICA DEL PROGRAMA DE FORMACION	2026-03-05 20:50:55.119892
5252	95	\N	ACTA VERIFICACION METODOLOGICA DEL PROGRAMA DE FORMACION	2026-03-05 20:50:55.121792
5253	95	\N	ACTA ENTREGA LOS PROGRAMAS DE CENTRO A REGIONAL	2026-03-05 20:50:55.124135
5254	95	\N	DOCUMENTO MAESTRO DE CONDICIONES DE CALIDAD	2026-03-05 20:50:55.125614
5255	95	\N	PROYECTO FORMATIVO	2026-03-05 20:50:55.127017
5256	95	\N	LISTA DE VERIFICACION TECNICA Y METODOLOGICA DEL PROYECTO FORMATIVO	2026-03-05 20:50:55.128426
5257	95	\N	MATRIZ PLANEACION PEDAGOGICA	2026-03-05 20:50:55.129738
5258	95	\N	GUIAS DE APRENDIZAJE	2026-03-05 20:50:55.131197
5259	95	\N	INSTRUMENTO DE EVALUACION	2026-03-05 20:50:55.132956
5260	95	\N	REVISION TECNICA Y PEDAGOGICA DEL DESARROLLO CURRICULAR	2026-03-05 20:50:55.135356
5261	\N	138	CATALOGO DE PRODUCTOS DE CENTRO DE FORMACION	2026-03-05 20:50:55.142573
5262	\N	138	PRE FACTURA DEL VALOR DEL ARTICULO CENTRO E IDENTIFICACION	2026-03-05 20:50:55.146073
5263	\N	138	CUPON DE PAGO	2026-03-05 20:50:55.148811
5264	\N	138	FACTURACION ELECTRONICA	2026-03-05 20:50:55.151532
5265	\N	138	CONSIGNACION POR VENTA DE BAJA CUANTIAS	2026-03-05 20:50:55.154698
5266	\N	139	CORREO SOLICITANDO INFORMACION DEL PRODUCTO O SERVICIO	2026-03-05 20:50:55.15835
5267	\N	139	SOLICITUD DE LA COTIZACION	2026-03-05 20:50:55.161085
5268	\N	139	RESPUESTA A LA SOLICITUD DE LA COTIZACION	2026-03-05 20:50:55.163388
5269	\N	139	SOLICITUD DE CDP Y RP	2026-03-05 20:50:55.165804
5270	\N	139	COMUNICACION DE ENVIO DE LOS DOCUMENTOS AL CENTRO PRODUCTOR O PRESTADOR DEL SERVICIO	2026-03-05 20:50:55.168603
5271	\N	139	CUENTA DE COBRO	2026-03-05 20:50:55.170872
5272	\N	139	RECIBO A SATISFACCION	2026-03-05 20:50:55.172658
5273	\N	139	COMUNICACION DE REMISION A CONTABILIDAD PARA PAGO DE OBLIGACION	2026-03-05 20:50:55.174578
5274	\N	139	CONSIGNACION POR VENTA DE BAJA CUANTIAS	2026-03-05 20:50:55.177553
5275	97	\N	DOCUMENTO DE IDENTIDAD VIGENTE	2026-03-05 20:50:55.179986
5276	97	\N	REGISTRO DEL SISTEMA DE MATRICULA ESTUDIANTIL DE EDUCACION BASICA Y MEDIA- SIMAT, ARTICULACION CON LA MEDIA	2026-03-05 20:50:55.181173
5277	97	\N	ACTA DE COMPROMISO DEL APRENDIZ	2026-03-05 20:50:55.182507
5278	97	\N	AUTORIZACION DE DATOS DE MENOR DE EDAD	2026-03-05 20:50:55.184382
5279	97	\N	DOCUMENTO DE IDENTIFICACION DEL PADRE, TUTOR O ACUDIENTE	2026-03-05 20:50:55.186014
5280	97	\N	CERTIFICADOS ACADEMICOS PARA EL PROCESO DE MATRICULA SALVO REGULACION ESPECIAL	2026-03-05 20:50:55.187554
5281	97	\N	DOCUMENTO DE CONVALIDACION DE CERTIFICADOS ACADEMICOS U OTROS	2026-03-05 20:50:55.18888
5282	97	\N	CERTIFICADO DE AFILIACION EPS	2026-03-05 20:50:55.190075
5283	97	\N	RESULTADO PRUEBA ICFES, SABER 11	2026-03-05 20:50:55.19134
5284	97	\N	REGISTRO DE ASISTENCIA PARA FORMALIZAR MATRICULA	2026-03-05 20:50:55.192506
5285	97	\N	CONSTANCIA DE RECONOCIMIENTO PARA PENSION DE SOBREVIVIENTES	2026-03-05 20:50:55.193726
5286	97	\N	LLAMADO DE ATENCION ESCRITO ACADEMICO O DISCIPLINARIO	2026-03-05 20:50:55.195076
5287	97	\N	SOLICITUD DE NOVEDADES REINGRESO, APLAZAMIENTO, RETIRO VOLUNTARIO, TRASLADO Y CONDICIONAMIENTO	2026-03-05 20:50:55.196285
5288	97	\N	RESPUESTA A SOLICITUD DE NOVEDAD	2026-03-05 20:50:55.197282
5289	97	\N	ACTAS DE REUNION DEL COMITE DE SEGUIMIENTO Y EVALUACION DE ETAPA LECTIVA Y/O PRODUCTIVA	2026-03-05 20:50:55.198795
5290	97	\N	RESOLUCION DE REINGRESO, SANCIONATORIA O CANCELACION MATRICULA, PLAN DE MEJORAMIENTO ACADEMICO O DISCIPLINARIO	2026-03-05 20:50:55.200404
5291	97	\N	SOLICITUD DE RECURSO DE REPOSICION	2026-03-05 20:50:55.201735
5292	97	\N	ACTO ADMINISTRATIVO RECURSO REPOSICION	2026-03-05 20:50:55.203364
5293	97	\N	COMUNICACION DE PRESENTACION ETAPA PRACTICA LECTIVA	2026-03-05 20:50:55.204855
5294	97	\N	ACTA DE CIERRE ETAPA LECTIVA	2026-03-05 20:50:55.206312
5295	97	\N	COMUNICACION SELECCION DE ETAPA PRODUCTIVA	2026-03-05 20:50:55.207827
5296	97	\N	AFILIACION AL SISTEMA GENERAL DE RIESGOS LABORALES DE APRENDICES - ARL	2026-03-05 20:50:55.209355
5297	97	\N	REGISTRO PLANEACION, SEGUIMIENTO Y EVALUACION DE LA ETAPA PRODUCTIVA	2026-03-05 20:50:55.211227
5298	97	\N	BITACORA DE SEGUIMIENTO ETAPA PRODUCTIVA	2026-03-05 20:50:55.213411
5299	97	\N	SOLICITUD DE CAMBIO DE ETAPA PRODUCTIVA	2026-03-05 20:50:55.214985
5300	97	\N	QUEJA O RECLAMACION POR EL APRENDIZ DEL PROCESO DE FORMACION	2026-03-05 20:50:55.216528
5301	97	\N	CERTIFICADO DE APROBACION EMPRESA TERMINACION ETAPA PRODUCTIVA	2026-03-05 20:50:55.218413
5302	97	\N	INFORME DE BIENESTAR DEL APRENDIZ RUTA DE ATENCION PARA LA PREVENCION DE LA DESERCION	2026-03-05 20:50:55.220312
5303	97	\N	DOCUMENTO DE IDENTIDAD EN CASO DE CAMBIO DEL MISMO	2026-03-05 20:50:55.221878
5304	97	\N	PAZ Y SALVO ACADEMICO ADMINISTRATIVO O COMUNICACION DE INSTITUCION EDUCATIVA	2026-03-05 20:50:55.22324
5305	97	\N	CERTIFICADO DE INSCRIPCION EN EL APLICATIVO DE LA APE	2026-03-05 20:50:55.224705
5306	97	\N	RESULTADOS DE LA PRUEBA SABER TYT ANTE EL ICFES PARA APRENDICES DEL NIVEL TECNOLOGICO	2026-03-05 20:50:55.226705
5307	97	\N	CONSTANCIA DE BUENA CONDUCTA	2026-03-05 20:50:55.22891
5308	97	\N	CONTROL Y EXPEDICION Y ENTREGA DE DUPLICADOS ANOS ANTERIORES AL ANO 2000	2026-03-05 20:50:55.230479
5309	97	\N	SOLICITUD MODIFICACION DE DOCUMENTOS ACADEMICOS CON SU RESPECTIVO SOPORTE	2026-03-05 20:50:55.231821
5310	97	\N	CONSTANCIA DE VALIDACION ACADEMICA PARA APOSTILLAR	2026-03-05 20:50:55.233135
5311	\N	140	PROYECTO DE VIABILIDAD ARTICULACION CON LA MEDIA	2026-03-05 20:50:55.238257
5312	\N	140	AUTODIAGNOSTICO INSTITUCION EDUCATIVA ARTICULACION CON LA MEDIA	2026-03-05 20:50:55.240074
5313	\N	140	NOTIFICACION NOVEDADES AMBIENTES DE FORMACION	2026-03-05 20:50:55.241715
5314	\N	140	PLAN ACADEMICO O DE FORMACION PLAN DE ACCION	2026-03-05 20:50:55.243762
5315	\N	140	ACTA COMPROMISO CON INSTITUCION EDUCATIVA	2026-03-05 20:50:55.245346
5316	\N	140	ACTA DE PLANEACION OFERTA EDUCATIVA	2026-03-05 20:50:55.246837
5317	\N	140	PLAN OPERATIVO	2026-03-05 20:50:55.248381
5318	\N	140	CRONOGRAMA CHARLAS INFORMATIVAS	2026-03-05 20:50:55.25042
5319	\N	140	ACTA DE SENSIBILIZACION ARTICULACION CON LA MEDIA	2026-03-05 20:50:55.254113
5320	\N	140	ARTICULACION CURRICULO EDUCACION MEDIA Y PROGRAMA DE FORMACION SENA	2026-03-05 20:50:55.256857
5321	\N	140	ACTA DE TRANSFERENCIA TECNICA Y PEDAGOGICA	2026-03-05 20:50:55.259728
5322	\N	140	PLANEACION PEDAGOGICA	2026-03-05 20:50:55.262585
5323	\N	140	LISTA DE VERIFICACION PROCEDIMIENTO EJECUCION DE LA FORMACION	2026-03-05 20:50:55.264593
5324	\N	140	REPORTE DE INASISTENCIA	2026-03-05 20:50:55.267101
5325	\N	140	JUSTIFICACION INASISTENCIA	2026-03-05 20:50:55.270095
5326	\N	140	REPORTE DE JUICIOS DE EVALUACION ETAPA LECTIVA Y PRODUCTIVA	2026-03-05 20:50:55.272037
5327	\N	140	PROGRAMACION DE AULAS MOVILES	2026-03-05 20:50:55.273633
5328	\N	140	INFORME DE SEGUIMIENTO Y EVALUACION DEL PROCESO	2026-03-05 20:50:55.275601
5329	\N	141	MATRIZ DE VALORACION DEL MODELO DE NEGOCIO	2026-03-05 20:50:55.278425
5330	\N	141	PLAN DE NEGOCIO FONDO EMPRENDER	2026-03-05 20:50:55.280155
5331	\N	141	CAMARA DE COMERCIO EMPRESA CREADA	2026-03-05 20:50:55.282601
5332	\N	141	REGISTRO UNICO TRIBUTARIO- RUT EMPRESA ESTABLECIDA	2026-03-05 20:50:55.284862
5333	\N	141	ACTA DE REUNION REGIONAL 	2026-03-05 20:50:55.287331
5334	\N	141	ACTAS DE INTERVENTORIA 	2026-03-05 20:50:55.289025
5335	\N	141	CORREO ELECTRONICO DE CIERRE FORTUITO DEL SERVICIO DE ASESORIA	2026-03-05 20:50:55.291712
5336	\N	141	CORREO ELECTRONICO DE CIERRE DE SERVICIO DE ASESORIA	2026-03-05 20:50:55.293361
5337	\N	142	PLAN DE ACCION Y SEGUIMIENTO	2026-03-05 20:50:55.2959
5338	\N	142	LISTA DE ASISTENCIA JORNADA DE ORIENTACION	2026-03-05 20:50:55.29723
5339	\N	142	LISTA DE ASISTENCIA DE ENTRENAMIENTO	2026-03-05 20:50:55.299363
5340	\N	142	CAMARA DE COMERCIO EMPRESA ESTABLECIDA	2026-03-05 20:50:55.300877
5341	\N	142	REGISTRO UNICO TRIBUTARIO RUT EMPRESA ESTABLECIDA	2026-03-05 20:50:55.303631
5342	\N	142	PLAN DE ACCION DE FORTALECIMIENTO EMPRESARIAL	2026-03-05 20:50:55.305494
5343	\N	142	CORREO ELECTRONICO DE CIERRE FORTUITO DEL SERVICIO DE ASESORIA	2026-03-05 20:50:55.307735
5344	\N	142	CORREO ELECTRONICO DE CIERRE DE SERVICIO DE ASESORIA	2026-03-05 20:50:55.309371
5345	\N	143	PROGRAMA SENA EMPRENDE RURAL	2026-03-05 20:50:55.311828
5346	\N	143	REGISTRO DE SIMULADOR DE PLANEACION DE FORMACION	2026-03-05 20:50:55.313479
5347	\N	143	LISTADO DE ASISTENCIA PARA PROGRAMAS DE FORMACION PRESENCIAL	2026-03-05 20:50:55.316011
5348	\N	143	ACTA DE ENTREGA DE MATERIAL DE FORMACION	2026-03-05 20:50:55.317631
5349	\N	143	ACTA DE CREACION DE UNIDAD PRODUCTIVA	2026-03-05 20:50:55.320244
5350	\N	143	MODELO DE NEGOCIO UNIDAD PRODUCTIVA	2026-03-05 20:50:55.322372
5351	\N	143	ACTA DE SEGUIMIENTO DE EJECUCION DEL PROGRAMA SENA EMPRENDE RURAL	2026-03-05 20:50:55.324592
5352	\N	143	REPORTE FINAL DE ASESORIA EMPRESAS Y UNIDADES PRODUCTIVAS	2026-03-05 20:50:55.326531
5353	\N	143	INFORME FINAL DE FORTALECIMIENTO DE UNIDAD PRODUCTIVA	2026-03-05 20:50:55.328447
5354	\N	144	PLAN DE ACCION DE BIENESTAR DEL APRENDIZ	2026-03-05 20:50:55.331548
5355	\N	144	ACTA DE ELECCION DE REPRESENTANTE O VOCERO	2026-03-05 20:50:55.333269
5356	\N	144	ACTA DE APROBACION DEL PBCF	2026-03-05 20:50:55.334797
5357	\N	144	PLAN DE MEJORAMIENTO	2026-03-05 20:50:55.337273
5358	\N	145	CIRCULAR DE APERTURA CONVOCATORIA	2026-03-05 20:50:55.340715
5359	\N	145	ACTA DE EVIDENCIA DE DIVULGACION DE LA CONVOCATORIA	2026-03-05 20:50:55.342325
5360	\N	145	REPORTE DE INSCRITOS	2026-03-05 20:50:55.343779
5361	\N	145	REPORTE DE PRIORIZACION	2026-03-05 20:50:55.345276
5362	\N	145	LISTADO DE ELEGIBLES	2026-03-05 20:50:55.347377
5363	\N	145	ACTA DE DESEMPATE	2026-03-05 20:50:55.348961
5364	\N	145	ACTA DEL ENCUENTRO DE SOCIALIZACION DE APRENDICES BENEFICIADOS	2026-03-05 20:50:55.350563
5365	\N	145	RESOLUCION ADJUDICACION	2026-03-05 20:50:55.352031
5366	\N	145	RESOLUCION CANCELACION O SUSPENSION	2026-03-05 20:50:55.354936
5367	\N	145	RESOLUCION Y REPORTE DE DESEMBOLSO MENSUAL	2026-03-05 20:50:55.356759
5368	\N	145	REGISTRO SOCIOECONOMICO APRENDICES CALIFICADOS Y PRIORIZADOS	2026-03-05 20:50:55.358263
5369	\N	145	CONSTANCIA DE CUMPLIMIENTO DE REQUISITOS ACADEMICO	2026-03-05 20:50:55.359654
5370	\N	145	ACTA DE SEGUIMIENTO MENSUAL DE VERIFICACION DE CUMPLIMIENTO DE REQUISITOS Y OBLIGACIONES	2026-03-05 20:50:55.361126
5371	\N	145	RESOLUCION DE ADJUDICACION DE REEMPLAZO	2026-03-05 20:50:55.363323
5372	\N	146	CIRCULAR DE APERTURA CONVOCATORIA	2026-03-05 20:50:55.365634
5373	\N	146	ACTA DE EVIDENCIA DE DIVULGACION DE LA CONVOCATORIA	2026-03-05 20:50:55.367614
5374	\N	146	REPORTE DE INSCRITOS	2026-03-05 20:50:55.371048
5375	\N	146	REPORTE DE PRIORIZACION	2026-03-05 20:50:55.375017
5376	\N	146	LISTADO DE ELEGIBLES	2026-03-05 20:50:55.376653
5377	\N	146	ACTA DE DESEMPATE	2026-03-05 20:50:55.378683
5378	\N	146	ACTA DEL ENCUENTRO DE SOCIALIZACION DE APRENDICES BENEFICIADOS	2026-03-05 20:50:55.380517
5379	\N	146	RESOLUCION ADJUDICACION	2026-03-05 20:50:55.382411
5380	\N	146	RESOLUCION CANCELACION O SUSPENSION	2026-03-05 20:50:55.384366
5381	\N	146	RESOLUCION DESEMBOLSO	2026-03-05 20:50:55.387404
5382	\N	146	REGISTRO SOCIOECONOMICO APRENDICES CALIFICADOS Y PRIORIZADOS	2026-03-05 20:50:55.390289
5383	\N	147	CIRCULAR DE APERTURA CONVOCATORIA	2026-03-05 20:50:55.393303
5384	\N	147	ACTA DE EVIDENCIA DE DIVULGACION DE LA CONVOCATORIA	2026-03-05 20:50:55.395547
5385	\N	147	REPORTE DE INSCRITOS	2026-03-05 20:50:55.397242
5386	\N	147	REPORTE DE PRIORIZACION	2026-03-05 20:50:55.398994
5387	\N	147	LISTADO DE ELEGIBLES	2026-03-05 20:50:55.400678
5388	\N	147	ACTA DE DESEMPATE	2026-03-05 20:50:55.403608
5389	\N	147	ACTA DEL ENCUENTRO DE SOCIALIZACION DE APRENDICES BENEFICIADOS	2026-03-05 20:50:55.405866
5390	\N	147	RESOLUCION ADJUDICACION	2026-03-05 20:50:55.407995
5391	\N	147	RESOLUCION CANCELACION O SUSPENSION	2026-03-05 20:50:55.409483
5392	\N	147	RESOLUCION DESEMBOLSO	2026-03-05 20:50:55.412237
5393	\N	147	REGISTRO SOCIOECONOMICO APRENDICES CALIFICADOS Y PRIORIZADOS	2026-03-05 20:50:55.413999
5394	\N	148	CIRCULAR DE APERTURA CONVOCATORIA	2026-03-05 20:50:55.416483
5395	\N	148	ACTA DE EVIDENCIA DE DIVULGACION DE LA CONVOCATORIA	2026-03-05 20:50:55.417885
5396	\N	148	REPORTE DE INSCRITOS	2026-03-05 20:50:55.421091
5397	\N	148	REPORTE DE PRIORIZACION	2026-03-05 20:50:55.423429
5398	\N	148	LISTADO DE ELEGIBLES	2026-03-05 20:50:55.42545
5399	\N	148	ACTA DE DESEMPATE	2026-03-05 20:50:55.427803
5400	\N	148	ACTA DEL ENCUENTRO DE SOCIALIZACION DE APRENDICES BENEFICIADOS	2026-03-05 20:50:55.429607
5401	\N	148	RESOLUCION ADJUDICACION	2026-03-05 20:50:55.431388
5402	\N	148	RESOLUCION CANCELACION O SUSPENSION	2026-03-05 20:50:55.433113
5403	\N	148	RESOLUCION DESEMBOLSO	2026-03-05 20:50:55.435407
5404	\N	148	REGISTRO SOCIOECONOMICO APRENDICES CALIFICADOS Y PRIORIZADOS	2026-03-05 20:50:55.437397
5405	\N	149	ACTA DE EVIDENCIA DE DIVULGACION DE LA CONVOCATORIA	2026-03-05 20:50:55.440025
5406	\N	149	CIRCULAR DE APERTURA CONVOCATORIA	2026-03-05 20:50:55.441664
5407	\N	149	TRAZABILIDAD DE APRENDICES BENEFICIARIOS CENTROS DE CONVIVENCIA	2026-03-05 20:50:55.444204
5408	\N	149	ACTA DE DESEMPATE	2026-03-05 20:50:55.446308
5409	\N	149	RESOLUCION DE ADJUDICACION	2026-03-05 20:50:55.448425
5410	\N	149	RESOLUCION DE CANCELACION O SUSPENSION	2026-03-05 20:50:55.450823
5411	\N	149	LEGALIZACION DE INGRESO AL INTERNADO	2026-03-05 20:50:55.45378
5412	\N	150	CIRCULAR DE APERTURA CONVOCATORIA	2026-03-05 20:50:55.458632
5413	\N	150	INFORME VERIFICACION DE REQUISITOS	2026-03-05 20:50:55.461838
5414	\N	150	ACTA DE DESEMPATE	2026-03-05 20:50:55.464306
5415	\N	150	RESOLUCION DE ADJUDICACION	2026-03-05 20:50:55.467556
5416	\N	150	RESOLUCION DE CANCELACION O SUSPENSION	2026-03-05 20:50:55.470218
5417	\N	150	INFORME DE EVALUACION	2026-03-05 20:50:55.471839
5418	\N	151	CIRCULAR DE APERTURA CONVOCATORIA	2026-03-05 20:50:55.475435
5419	\N	151	ACTA DE EVIDENCIA DE DIVULGACION DCON REGISTRO DE EVIDENCIA	2026-03-05 20:50:55.476803
5420	\N	151	REPORTE DE INSCRITOS	2026-03-05 20:50:55.478231
5421	\N	151	REPORTE DE PRIORIZACION DE ELEGIBLES	2026-03-05 20:50:55.479518
5422	\N	151	LISTADO DE ELEGIBLES	2026-03-05 20:50:55.480805
5423	\N	151	ACTA DE DESEMPATE	2026-03-05 20:50:55.48281
5424	\N	151	ACTA DEL ENCUENTRO DE SOCIALIZACION DE APRENDICES BENEFICIADOS	2026-03-05 20:50:55.484599
5425	\N	151	RESOLUCION ADJUDICACION	2026-03-05 20:50:55.487209
5426	\N	151	RESOLUCION CANCELACION O SUSPENSION	2026-03-05 20:50:55.48871
5427	\N	151	RESOLUCION Y REPORTE DE DESEMBOLSO MENSUALES	2026-03-05 20:50:55.490315
5428	\N	151	REGISTRO SOCIOECONOMICO	2026-03-05 20:50:55.492169
5429	\N	151	ACTA DE SEGUIMIENTO MENSUAL DE VERIFICACION DE CUMPLIMIENTO DE REQUISITOS Y OBLIGACIONES	2026-03-05 20:50:55.493698
5430	\N	152	ACTA DE CONSEJO EJECUTIVO DE MESA SECTORIAL	2026-03-05 20:50:55.495787
5431	\N	153	ACTA DE REUNION MESA SECTORIAL	2026-03-05 20:50:55.497613
5432	101	\N	IDENTIFICACION DE PERFIL CONSECUCION EXPERTOS TECNICOS	2026-03-05 20:50:55.499894
5433	101	\N	SOLICITUD CONSECUCION EXPERTOS TECNICOS	2026-03-05 20:50:55.50086
5434	101	\N	INVITACION A CONFIRMACION COMITE TECNICO	2026-03-05 20:50:55.501736
5435	101	\N	MATRIZ FUENTE DE INFORMACION DE INVESTIGACION SECTORIAL	2026-03-05 20:50:55.503385
5436	101	\N	MATRIZ ANALISIS CRITICO DE LA INFORMACION	2026-03-05 20:50:55.504798
5437	101	\N	ACTAS DE COMITES TECNICOS DE ELABORACION / ACTUALIZACION DE EFO	2026-03-05 20:50:55.505951
5438	101	\N	ESTRUCTURA FUNCIONAL DE LA OCUPACION -EFO	2026-03-05 20:50:55.507374
5439	101	\N	FICHA DE CARACTERIZACION DEL COMITE TECNICO DE ELABORACION / ACTUALIZACION ESTRUCTURA FUNCIONAL DE LA OCUPACION -EFO	2026-03-05 20:50:55.508576
5440	101	\N	LISTA DE AJUSTE VERIFICACION METODOLOGICA	2026-03-05 20:50:55.509822
5441	101	\N	ACTAS DE COMITES VALIDACION TECNICA	2026-03-05 20:50:55.510732
5442	101	\N	FORMATOS VALIDACION TECNICA	2026-03-05 20:50:55.511582
5443	101	\N	FICHA DE CARACTERIZACION COMITE DE VALIDACION TECNICA NORMALIZACION/ ESTANDARIZACION	2026-03-05 20:50:55.512516
5444	101	\N	LISTA DE AJUSTE VERIFICACION METODOLOGICA POS VALIDACION TECNICA	2026-03-05 20:50:55.513382
5445	101	\N	ACTA AVAL CONSEJO EJECUTIVO MESA SECTORIAL	2026-03-05 20:50:55.514755
5446	101	\N	RESPUESTA A ENCUESTA GRUPOS DE VALOR REALIMENTACION DE LA NORMA EN USO	2026-03-05 20:50:55.516227
5447	102	\N	INVITACION A CONFORMACION COMITE TECNICO	2026-03-05 20:50:55.517843
5448	102	\N	ACTAS DE COMITES TECNICOS DE ELABORACION / ACTUALIZACION DE MAPA FUNCIONAL	2026-03-05 20:50:55.518725
5449	102	\N	FICHA DE CARACTERIZACION DEL COMITE TECNICO DE ELABORACION / ACTUALIZACION MAPA FUNCIONAL	2026-03-05 20:50:55.520761
5450	102	\N	LISTA DE AJUSTE VERIFICACION METODOLOGICA	2026-03-05 20:50:55.522228
5451	102	\N	ACTAS DE COMITES VALIDACION TECNICA	2026-03-05 20:50:55.524528
5452	102	\N	VALIDACION TECNICA	2026-03-05 20:50:55.525866
5453	102	\N	FICHA DE CARACTERIZACION COMITE DE VALIDACION TECNICA MAPA	2026-03-05 20:50:55.52702
5454	102	\N	FUNCIONAL	2026-03-05 20:50:55.527976
5455	102	\N	LISTAS DE AJUSTE VERIFICACION METODOLOGICA POS VALIDACION TECNICA	2026-03-05 20:50:55.528914
5456	102	\N	ACTA AVAL CONSEJO EJECUTIVO MESA SECTORIAL	2026-03-05 20:50:55.530032
5457	103	\N	IDENTIFICACION DE PERFIL CONSECUCION EXPERTOS TECNICO	2026-03-05 20:50:55.53274
5458	103	\N	SOLICITUD CONSECUCION EXPERTOS TECNICO	2026-03-05 20:50:55.533829
5459	103	\N	INVITACION A CONFIRMACION COMITE TECNICO	2026-03-05 20:50:55.535063
5460	103	\N	MATRIZ FUENTE DE INFORMACION DE INVESTIGACION SECTORIAL	2026-03-05 20:50:55.536922
5461	103	\N	MATRIZ ANALISIS CRITICO DE LA INFORMACION	2026-03-05 20:50:55.538621
5462	103	\N	ACTAS DE COMITES TECNICOS DE ELABORACION ACTUALIZACION DE NORMALIZACION Y ESTANDARIZACION	2026-03-05 20:50:55.54007
5463	103	\N	ESTRUCTURA DE ESTANDAR /NORMA SECTORIAL DE COMPETENCIA LABORALES	2026-03-05 20:50:55.541241
5464	103	\N	MATRIZ CORRELACION DE DESEMPENO LABORAL	2026-03-05 20:50:55.542379
5465	103	\N	ESTRUCTURA FUNCIONAL DE LA OCUPACION -EFO ESTANDAR /NORMA SECTORIAL DE COMPETENCIA LABORALES	2026-03-05 20:50:55.558785
5466	103	\N	FICHA DE CARACTERIZACION DEL COMITE TECNICO DE ELABORACION / ACTUALIZACION DE NORMALIZACION/ ESTANDARIZACION	2026-03-05 20:50:55.560108
5467	103	\N	SOLICITUD DE ACOMPANAMIENTOS METODOLOGICO	2026-03-05 20:50:55.561294
5468	103	\N	LISTA DE VERIFICACION METODOLOGICA	2026-03-05 20:50:55.562687
5469	103	\N	SOLICITUD CONSULTA PUBLICA	2026-03-05 20:50:55.564099
5470	103	\N	E-CARD DIVULGACION CONSULTA PUBLICA	2026-03-05 20:50:55.565349
5471	103	\N	ESTRUCTURA DE ESTANDAR /NORMA SECTORIAL DE COMPETENCIA LABORAL	2026-03-05 20:50:55.566642
5472	103	\N	INVITACION A PARTICIPAR EN CONSULTA PUBLICA	2026-03-05 20:50:55.567813
5473	103	\N	REPORTE DE OBSERVACIONES DE EXPERTOS TECNICOS	2026-03-05 20:50:55.568849
5474	103	\N	INFORME DE COMENTARIOS DE EXPERTOS TECNICOS A NORMA ESTANDAR	2026-03-05 20:50:55.570937
5475	103	\N	ACTAS DE COMITES VALIDACION TECNICA	2026-03-05 20:50:55.572334
5476	103	\N	FORMATOS VALIDACION TECNICA	2026-03-05 20:50:55.573548
5477	103	\N	FICHA DE CARACTERIZACION COMITE DE VALIDACION TECNICA NORMALIZACION/ ESTANDARIZACION	2026-03-05 20:50:55.575343
5478	103	\N	LISTA DE VERIFICACION METODOLOGICA POST VALIDACION	2026-03-05 20:50:55.577139
5479	103	\N	CARTA DE PRESIDENTE DE MESA SECTORIAL DE PRESENTACION DE PRODUCTO	2026-03-05 20:50:55.579136
5480	103	\N	ACTA AVAL CONSEJO EJECUTIVO MESA SECTORIAL	2026-03-05 20:50:55.581132
5481	103	\N	SOLICITUD DE PRESENTACION DE ESTANDAR /NORMA SECTORIAL DE COMPETENCIA LABORAL A CONSEJO DIRECTIVO NACIONAL SENA	2026-03-05 20:50:55.582697
5482	103	\N	NORMA DE COMPETENCIA LABORAL	2026-03-05 20:50:55.584183
5483	103	\N	RESPUESTA A ENCUESTA GRUPOS DE VALOR REALIMENTACION DE LA NORMA EN USO	2026-03-05 20:50:55.58629
5484	\N	154	PLAN ACCION DE LA MESA SECTORIAL	2026-03-05 20:50:55.589909
5485	\N	154	MATRIZ DE SEGUIMIENTO A LA GESTION AL PLAN ACCION DE LA MESA	2026-03-05 20:50:55.591496
5486	\N	154	SECTORIAL	2026-03-05 20:50:55.593348
5487	\N	154	INFORME DE EVALUACION DE GESTION DEL PLAN ACCION DE LA MESA SECTORIAL	2026-03-05 20:50:55.595971
5488	\N	155	REQUERIMIENTO DE NECESIDADES DE ESTANDARIZACION / NORMALIZACION	2026-03-05 20:50:55.59995
5489	\N	155	SOLICITUD DE REQUERIMIENTO E NECESIDADES DE ESTANDARIZACION / NORMALIZACION	2026-03-05 20:50:55.601546
5490	\N	155	ACTA DE APROBACION DEL PAE CONSEJO EJECUTIVO	2026-03-05 20:50:55.604402
5491	\N	155	PROYECTO ANUAL DE ESTANDARIZACION PRELIMINAR DE COMPETENCIAS LABORALES -PAE	2026-03-05 20:50:55.60641
5492	\N	155	COMUNICACION CONCERTACION PAE CENTROS DE FORMACION	2026-03-05 20:50:55.608044
5493	\N	155	RESPUESTA DE COMUNICACION CONCERTACION PAE CENTROS DE	2026-03-05 20:50:55.6097
5494	\N	155	FORMACION	2026-03-05 20:50:55.612263
5495	\N	155	PROYECTO ANUAL DE ESTANDARIZACION DE COMPETENCIAS LABORALES DEFINITIVO	2026-03-05 20:50:55.614501
5496	\N	155	SOLICITUDES Y RESPUESTAS A NOVEDADES DEL PAE	2026-03-05 20:50:55.616939
5497	\N	155	RESPUESTA A INFORMES DE SEGUIMIENTOS Y AVANCES DEL PAE	2026-03-05 20:50:55.620089
5498	\N	156	ACTA COMITE DE GESTION DE EVALUACION Y CERTIFICACION DE COMPETENCIAS LABORALES	2026-03-05 20:50:55.623376
5499	105	\N	ACUERDO DE CONFIDENCIALIDAD DE LOS ACTORES DEL PROCESO DE ECCL	2026-03-05 20:50:55.626221
5500	105	\N	DECLARACION JURAMENTADA DE LA NO EXISTENCIA DE CONFLICTO DE INTERES	2026-03-05 20:50:55.628466
5501	105	\N	SOLICITUD DEL SERVICIO POR LINEA ORGANIZACION	2026-03-05 20:50:55.630361
5502	105	\N	RESPUESTA DEL SERVICIO POR LINEA ORGANIZACION	2026-03-05 20:50:55.63215
5503	105	\N	ACTA DE COMPROMISO AL PROCESO DE EVALUACION CERTIFICACION DE COMPETENCIAS LABORALES POR LINEA ORGANIZACION	2026-03-05 20:50:55.634055
5504	105	\N	CRONOGRAMA DEL GRUPO	2026-03-05 20:50:55.636254
5505	105	\N	LISTA DE ASISTENCIA INDUCCION A LOS CANDIDATOS	2026-03-05 20:50:55.637896
5506	105	\N	COPIA DE DOCUMENTO DE IDENTIDAD DEL CANDIDATO	2026-03-05 20:50:55.639871
5507	105	\N	CERTIFICACION LABORAL DEL CANDIDATO O PLANTILLA MODELO DE CONSTANCIA DE EXPERIENCIA LABORAL O RESULTADO DE FASE DIAGNOSTICA	2026-03-05 20:50:55.641642
5508	105	\N	SOPORTES DE REQUISITOS ADICIONALES	2026-03-05 20:50:55.643308
5509	105	\N	ACEPTACION TERMINOS Y CONDICIONES PARA CANDIDATOS	2026-03-05 20:50:55.644736
5510	105	\N	REPORTE DE INSCRITOS	2026-03-05 20:50:55.646066
5511	105	\N	CLAVE DE RESPUESTA DE VALORACION DE CONOCIMIENTO	2026-03-05 20:50:55.647584
5512	105	\N	ACTA DE CRITERIOS DE DESEMPENO CRITICO / AMBIENTE SIMULADO	2026-03-05 20:50:55.648947
5513	105	\N	HOJA DE RESPUESTA DE VALORACION DE CONOCIMIENTO	2026-03-05 20:50:55.650548
5514	105	\N	REPORTE DE VALORACIONES CANDIDATO	2026-03-05 20:50:55.652633
5515	105	\N	REPORTE CANDIDATOS EVIDENCIAS	2026-03-05 20:50:55.654586
5516	105	\N	COMUNICACION DE NOVEDADES DEL CANDIDATO	2026-03-05 20:50:55.655895
5517	105	\N	COMUNICACION DE NOVEDADES DEL PROYECTO	2026-03-05 20:50:55.657395
5518	105	\N	PLAN DE VERIFICACION	2026-03-05 20:50:55.659556
5519	105	\N	ACTA DE APERTURA DE VERIFICACION DEL PROYECTO	2026-03-05 20:50:55.661208
5520	105	\N	ACTA DE CIERRE DE VERIFICACION DEL PROYECTO	2026-03-05 20:50:55.662563
5521	105	\N	PLAN DE ACCION PARA EL TRATAMIENTO DE ACCIONES CORRECTIVAS VERIFICACION DE PROYECTO	2026-03-05 20:50:55.664221
5522	105	\N	INFORME DE VERIFICACION DEL PROYECTO	2026-03-05 20:50:55.665887
5523	\N	157	PROYECTO DE INVESTIGACION, INNOVACION Y DIVULGACION - SENNOVA-	2026-03-05 20:50:55.669399
5524	\N	157	FORMULACION DEL PROYECTO	2026-03-05 20:50:55.671718
5525	\N	157	EVALUACION DEL PROYECTO FORMULADO	2026-03-05 20:50:55.673444
5526	\N	157	ACTA DE APROBACION REGIONAL	2026-03-05 20:50:55.675227
5527	\N	157	ACTA DE INICIO DEL PROYECTO	2026-03-05 20:50:55.676945
5528	\N	157	ACTA DE CONFIDENCIALIDAD	2026-03-05 20:50:55.67861
5529	\N	157	PLAN DE GESTION DE CRONOGRAMA DEL PROYECTO	2026-03-05 20:50:55.680298
5530	\N	157	FICHA GRUPO DE INVESTIGACION	2026-03-05 20:50:55.68205
5531	\N	157	FICHA TECNICA DE LA COMPRA	2026-03-05 20:50:55.684257
5532	\N	157	INFORME DE SEGUIMIENTO TECNICO	2026-03-05 20:50:55.687035
5533	\N	157	INFORME DE EJECUCION PRESUPUESTAL	2026-03-05 20:50:55.688952
5534	\N	157	EVALUACION DEL MARCO LOGICO DEL PROYECTO	2026-03-05 20:50:55.690592
5535	\N	157	ARTICULO PARA PONENCIAS	2026-03-05 20:50:55.692699
5536	\N	157	PATENTE	2026-03-05 20:50:55.694993
5537	\N	157	REGISTRO DE MARCA	2026-03-05 20:50:55.69722
5538	\N	157	LIBRO	2026-03-05 20:50:55.699272
5539	\N	157	FICHA TECNICA PROTOTIPO	2026-03-05 20:50:55.701769
5540	\N	157	INFORME FINAL DEL PROYECTO	2026-03-05 20:50:55.704188
5541	\N	157	ACTA DE CIERRE DEL PROYECTO	2026-03-05 20:50:55.706358
5542	106	\N	LISTA VERIFICACION PERFIL DE INGRESO	2026-03-05 20:51:15.601241
5543	106	\N	PERFILES DE INGRESO	2026-03-05 20:51:15.606045
5544	106	\N	EVALUACION DIAGNOSTICA DE ITEMS	2026-03-05 20:51:15.608114
5545	106	\N	PLAN DE DISENO ITEMS	2026-03-05 20:51:15.610166
5546	106	\N	ACUERDO CONFIDENCIALIDAD DEL DISENADOR	2026-03-05 20:51:15.611534
5547	106	\N	LISTA DE CHEQUEO ITEMS	2026-03-05 20:51:15.612961
5548	106	\N	SOLICITUD PRUEBAS	2026-03-05 20:51:15.61477
5549	106	\N	REGISTRO DE RESULTADOS TALLER ACTITUDINAL	2026-03-05 20:51:15.616275
5550	106	\N	TALLER ACTITUDINAL	2026-03-05 20:51:15.617619
5551	106	\N	CONSOLIDADO DE RESULTADOS	2026-03-05 20:51:15.619413
5552	107	\N	DERECHO DE PETICION	2026-03-05 20:51:15.623459
5553	107	\N	RESPUESTA A DERECHO DE PETICION	2026-03-05 20:51:15.62508
5554	\N	158	INFORME DE GESTION	2026-03-05 20:51:15.632704
5555	\N	158	COMUNICACION DE REMISION INFORME	2026-03-05 20:51:15.634902
5556	\N	159	PLAN DE ACCION DE LA VIGENCIA	2026-03-05 20:51:15.640232
5557	\N	159	RESOLUCION CALENDARIO ACADEMICO	2026-03-05 20:51:15.642148
5558	\N	159	RESOLUCION CONVOCATORIA DE LA OFERTA	2026-03-05 20:51:15.643578
5559	\N	159	REPORTE DE PLANEACION INDICATIVA OFERTA ABIERTA TITULADA	2026-03-05 20:51:15.64481
5560	\N	159	ACTA DE PLANEACION DE OFERTA DEL CENTRO DE FORMACION	2026-03-05 20:51:15.64613
5561	\N	159	ACTA DE APROBACION DE OFERTA CONCERTADA CON CENTRO SUSCRITA POR EL DIRECTOR REGIONAL O DIRECCION DE FORMACION PROFESIONAL	2026-03-05 20:51:15.64735
5562	\N	159	INFORME DE SEGUIMIENTO A LA OFERTA EDUCATIVA DEL CENTRO DE FORMACION	2026-03-05 20:51:15.64904
5563	\N	160	PLAN DE ACCION DE LA VIGENCIA	2026-03-05 20:51:15.65114
5564	\N	160	REGISTRO DE SOLICITUDES	2026-03-05 20:51:15.653008
5565	\N	160	ACTA DE COMPROMISO ENTRE LA EMPRESA Y EL SENA	2026-03-05 20:51:15.655298
5566	\N	160	PLAN OPERATIVO DE LA OFERTA ESPECIAL COMPLEMENTARIA	2026-03-05 20:51:15.65687
5567	\N	160	REPORTE DE VERIFICACION CONDICIONES MINIMAS DE CALIDAD DE AMBIENTES DE FORMACION	2026-03-05 20:51:15.659348
5568	\N	161	COMUNICACION DE SOLICITUD DE MATRICULA	2026-03-05 20:51:15.662524
5569	\N	161	REPORTE DE NOVEDADES DE LOS AMBIENTES DE APRENDIZAJE DE FORMACION	2026-03-05 20:51:15.664149
5570	\N	161	COMUNICACION DE OBSERVACIONES A SOLICITUD DE MATRICULA	2026-03-05 20:51:15.666069
5571	\N	161	REPORTES DE INSCRIPCION Y MATRICULA	2026-03-05 20:51:15.667435
5572	\N	161	INFORME DE ANALISIS DE EJECUCION, CERTIFICACION Y DESERCION	2026-03-05 20:51:15.66941
\.


--
-- Data for Name: user_trd_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_trd_permissions (id, user_id, series_id, subseries_id, can_view, can_upload) FROM stdin;
1	7	97	\N	1	1
2	15	95	\N	1	1
3	16	97	\N	1	1
4	18	\N	161	1	1
5	18	\N	160	1	1
6	18	\N	159	1	1
7	18	109	\N	1	1
8	18	\N	158	1	1
9	18	108	\N	1	1
10	18	107	\N	1	1
11	18	106	\N	1	1
12	18	97	\N	1	1
13	19	97	\N	1	1
14	20	97	\N	1	1
15	21	97	\N	1	1
16	23	97	\N	1	1
17	24	97	\N	1	1
18	25	97	\N	1	1
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, full_name, area, "position", document_no, password_hash, email, role, organization_id, is_active, must_change_password) FROM stdin;
25	Miguel Felipe Sierra	SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL	Lider Articulación	91301831	$2b$10$yTblIrzyNoo61VZxsHnSXunsBBI4BKHEBlBVzKqMEdZnK2gudUGYO	msierrap@sena.edu.co	user	8	1	0
1	Administrador	Sistemas	Admin	123456789	$2b$10$fJ1.Hl1sPjDQmNLLHhx2pO8x47h3yYeWT68dXqYRAliIfCgSMMwg.	admin@sena.edu.co	admin	\N	1	0
3	Administrador Sistema	\N	\N	admin	$2b$10$snMxt8evFV0CQhomB8nghO9sa/UzpYCbp4SXg/iDrJ1.oREcqok6K	\N	admin	\N	1	0
2	Usuario 1032340681	\N	\N	1032340681	$2b$10$JKJL5GyPEgOLzYSdcHRTvuzery.MClwVAW6bELLqx/JyhyItD/rBK	\N	admin	\N	0	0
4	Luis Ernesto Parada Moreno	Administración	Gestión Documental	1098680638	$2b$12$Yq.ScOOi2lqNkUybJ85NhOr4x2YvgAGf53ly.K2i44P2TMobu6RTa	luepitar@gmail.com	superadmin	\N	1	0
7	Claudia Milena Vera Castellanos	SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL	Instructora seguimiento etapa productiva	63553823	$2b$10$l.hafrKcQBhzSUMJd./pYuwX5KFtVlSIYhvFmBOxfTkA10jn9ruiS	cmvera@sena.edu.co	user	8	1	0
15	Saira Cristina Urrutia Vargas	SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL	Profesional	63469365	$2b$10$4.Rs/BhTM52O37mTG6ptDu.0AC7ovmy4wSqNMOlwShF7kxVDkc/rC	saurrutia@sena.edu.co	user	8	1	0
17	Edward Alfonso Monroy Arandia	SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL	Profesional	91522941	$2b$10$zRQKwsw/YivKzAX8TETxEeC0L0ZQTIctH8w2IeqlexdCfjFbt0F.W	eamonroy@sena.edu.co	user	8	1	0
16	Johana Gonzalez Gonzalez	SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL	Apoyo Formación	1099209709	$2b$10$PajDNI.qNIdsY84fPOSwOe5kb.6/d9cbFBV8BHtiK3lOhiUBGLXUe	gonzalezg@sena.edu.co	user	8	1	0
18	MARÍA CAROLINA RODRÍGUEZ AGUILLÓN		Profesional G02	63538698	$2b$10$j/E.dhW9IzlZi.d.GtKbHuCd5ZTZZcjchkX1ijm/28Zwc/XV3lX7a	mrodrigueza@sena.edu.co	user	7	1	0
19	LUIS MIGUEL HERNANDEZ SILVA		Contratista	1095820807	$2b$10$avcKIJ6p8yvvz4YgZhO8nOVzLSBrypBSpx5cF4vREcGagPnie/1NK	lmhernandezs@sena.edu.co	user	7	1	0
20	MAYERLY FERNANDA MARTINEZ MENDEZ		Contratista	1098748979	$2b$10$o9505L4T2sBmBvu1DKzdS.kVKnSTY3MOwIK6VU9Q/Qow4gyXAutAC	mfmartinezn@sena.edu.co	user	7	1	0
21	JESUS ALBERTO GONZALEZ CASTRO		Contratista	1095952610	$2b$10$NVkyqKHVjvhqn3ZwVQrQ0eqDvOIL1g2laUKt6WDrpE.2ebiZcvAE.	jagonzalezca@sena.edu.co	user	7	1	0
22	LUDIN MARCELA BENAVIDES VARGAS		Auxiliar G01	1055272733	$2b$10$xNaQYv2QZ1lVnGRowuy68eyBobpNY7tna0DgjdHj6bwtwTfaBZ.fC	lbenavidesv@sena.edu.co	user	7	1	0
23	William Alberto Mejia Santamaria	SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL	coordinador	7571746	$2b$10$5c7Lq3L4D1hmZ4mW/7ozqO0UX12ldrTDahkM0HI3.NJTCsb8Pstdu	wmejia@sena.edu.co	user	8	1	0
24	Libia Crsitina Parada	SUBDIRECCION DE CENTRO DE FORMACION PROFESIONAL	apoyo coordinación	37863702	$2b$10$7lItOX2JdM5E51KgxdwXL.bE6BOiS1ysPDYBp8AneMjaZh.5P8CWe	lparadaj@sena.edu.co	user	8	1	0
\.


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.documents_id_seq', 11, true);


--
-- Name: expedientes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.expedientes_id_seq', 1845, true);


--
-- Name: organization_structure_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.organization_structure_id_seq', 8, true);


--
-- Name: role_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.role_permissions_id_seq', 213, true);


--
-- Name: system_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.system_settings_id_seq', 38, true);


--
-- Name: trd_series_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trd_series_id_seq', 109, true);


--
-- Name: trd_subseries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trd_subseries_id_seq', 161, true);


--
-- Name: trd_typologies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.trd_typologies_id_seq', 5572, true);


--
-- Name: user_trd_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.user_trd_permissions_id_seq', 18, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 26, true);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: expedientes expedientes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expedientes
    ADD CONSTRAINT expedientes_pkey PRIMARY KEY (id);


--
-- Name: organization_structure organization_structure_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organization_structure
    ADD CONSTRAINT organization_structure_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_name_module_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_name_module_id_key UNIQUE (role_name, module_id);


--
-- Name: system_settings system_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_key_key UNIQUE (key);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: trd_series trd_series_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trd_series
    ADD CONSTRAINT trd_series_pkey PRIMARY KEY (id);


--
-- Name: trd_subseries trd_subseries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trd_subseries
    ADD CONSTRAINT trd_subseries_pkey PRIMARY KEY (id);


--
-- Name: trd_typologies trd_typologies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trd_typologies
    ADD CONSTRAINT trd_typologies_pkey PRIMARY KEY (id);


--
-- Name: user_trd_permissions user_trd_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_trd_permissions
    ADD CONSTRAINT user_trd_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_trd_permissions user_trd_permissions_user_id_series_id_subseries_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_trd_permissions
    ADD CONSTRAINT user_trd_permissions_user_id_series_id_subseries_id_key UNIQUE (user_id, series_id, subseries_id);


--
-- Name: users users_document_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_document_no_key UNIQUE (document_no);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict Omk1M0t7cR09lcTIgCGwIW1BTWLJ9xPpeonSJdSrdXM95cvEIJXSZ4HnlEOksM3

