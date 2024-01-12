--
-- PostgreSQL database dump
--

CREATE SCHEMA unpadmin;


ALTER SCHEMA unpadmin OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: unpadmin; Owner: postgres
--

CREATE TABLE unpadmin.clients (
    client_id character(36) NOT NULL,
    reference_email character varying(255) NOT NULL,
    product character varying(255),
    subscription_date timestamp with time zone DEFAULT now() NOT NULL,
    notes text,
    preference_service_name character varying(255) NOT NULL,
    token_notify text
);


ALTER TABLE unpadmin.clients OWNER TO postgres;

--
-- Name: users_permissions; Type: TABLE; Schema: unpadmin; Owner: postgres
--

CREATE TABLE unpadmin.users_permissions (
    cf character varying(255) NOT NULL,
    username character varying(255),
    roles character varying(255)
);


ALTER TABLE unpadmin.users_permissions OWNER TO postgres;

--
-- Name: idx_10515419_primary; Type: INDEX; Schema: unpadmin; Owner: postgres
--

CREATE UNIQUE INDEX idx_10515419_primary ON unpadmin.clients USING btree (client_id);


--
-- Name: idx_10515435_primary; Type: INDEX; Schema: unpadmin; Owner: postgres
--

CREATE UNIQUE INDEX idx_10515435_primary ON unpadmin.users_permissions USING btree (cf);


--
-- Name: idx_clients_name_tenant; Type: INDEX; Schema: unpadmin; Owner: postgres
--

CREATE UNIQUE INDEX idx_clients_name ON unpadmin.clients USING btree (preference_service_name);

--
-- PostgreSQL database dump complete
--

