--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: unpadmin; Type: SCHEMA; Schema: -; Owner: unpadmin
--

CREATE SCHEMA unpadmin;


ALTER SCHEMA unpadmin OWNER TO unpadmin;

SET default_tablespace = '';

--
-- Name: clients; Type: TABLE; Schema: unpadmin; Owner: unpadmin
--

CREATE TABLE unpadmin.clients (
    client_id character(36) NOT NULL,
    preference_service_name character varying(255) NOT NULL,
    reference_email character varying(255) NOT NULL,
    subscription_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    token_notify text,
    owner character varying DEFAULT 'notify'::character varying NOT NULL,
    tenant character varying(16) NOT NULL,
    subscriptions_feed_enabled boolean DEFAULT FALSE
);


ALTER TABLE unpadmin.clients OWNER TO unpadmin;

--
-- Name: COLUMN clients.client_id; Type: COMMENT; Schema: unpadmin; Owner: unpadmin
--

COMMENT ON COLUMN unpadmin.clients.client_id IS 'uuid';


--
-- Name: tags; Type: TABLE; Schema: unpadmin; Owner: unpadmin
--

CREATE TABLE unpadmin.tags (
    uuid character varying NOT NULL,
    name character varying(30) NOT NULL,
    description character varying(255),
    created timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE unpadmin.tags OWNER TO unpadmin;

--
-- Name: tenants; Type: TABLE; Schema: unpadmin; Owner: unpadmin
--

CREATE TABLE unpadmin.tenants (
    uuid character varying NOT NULL,
    name character varying(16) NOT NULL,
    description character varying(255),
    created timestamp with time zone DEFAULT now() NOT NULL,
    io_manage_apikey character varying
);


ALTER TABLE unpadmin.tenants OWNER TO unpadmin;

--
-- Name: users_permissions; Type: TABLE; Schema: unpadmin; Owner: unpadmin
--

CREATE TABLE unpadmin.users_permissions (
    cf character varying(255) NOT NULL,
    username character varying(255),
    roles character varying(255)
);


ALTER TABLE unpadmin.users_permissions OWNER TO unpadmin;

--
-- Name: clients idx_2505332_primary; Type: CONSTRAINT; Schema: unpadmin; Owner: unpadmin
--

ALTER TABLE ONLY unpadmin.clients
    ADD CONSTRAINT idx_2505332_primary PRIMARY KEY (client_id);


--
-- Name: users_permissions idx_2505339_primary; Type: CONSTRAINT; Schema: unpadmin; Owner: unpadmin
--

ALTER TABLE ONLY unpadmin.users_permissions
    ADD CONSTRAINT idx_2505339_primary PRIMARY KEY (cf);


--
-- Name: tags name_unique; Type: CONSTRAINT; Schema: unpadmin; Owner: unpadmin
--

ALTER TABLE ONLY unpadmin.tags
    ADD CONSTRAINT name_unique UNIQUE (name);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: unpadmin; Owner: unpadmin
--

ALTER TABLE ONLY unpadmin.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (uuid);


--
-- Name: tenants tenant_name_unique; Type: CONSTRAINT; Schema: unpadmin; Owner: unpadmin
--

ALTER TABLE ONLY unpadmin.tenants
    ADD CONSTRAINT tenant_name_unique UNIQUE (name);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: unpadmin; Owner: unpadmin
--

ALTER TABLE ONLY unpadmin.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (uuid);


--
-- Name: idx_clients_name_tenant; Type: INDEX; Schema: unpadmin; Owner: unpadmin
--

CREATE UNIQUE INDEX idx_clients_name_tenant ON unpadmin.clients USING btree (preference_service_name, tenant);
