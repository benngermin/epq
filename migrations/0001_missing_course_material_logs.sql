CREATE TABLE IF NOT EXISTS "missing_course_material_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "question_version_id" integer NOT NULL,
  "question_id" integer NOT NULL,
  "loid" text NOT NULL,
  "course_number" text,
  "endpoint" text NOT NULL,
  "user_id" integer,
  "request_payload" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "missing_course_material_logs"
  ADD CONSTRAINT "missing_course_material_logs_question_version_id_question_versions_id_fk"
  FOREIGN KEY ("question_version_id") REFERENCES "question_versions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "missing_course_material_logs"
  ADD CONSTRAINT "missing_course_material_logs_question_id_questions_id_fk"
  FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "missing_course_material_logs"
  ADD CONSTRAINT "missing_course_material_logs_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "missing_course_material_logs_loid_idx"
  ON "missing_course_material_logs" ("loid");

CREATE INDEX IF NOT EXISTS "missing_course_material_logs_question_version_id_idx"
  ON "missing_course_material_logs" ("question_version_id");

CREATE INDEX IF NOT EXISTS "missing_course_material_logs_course_number_idx"
  ON "missing_course_material_logs" ("course_number");
