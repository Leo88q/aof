import React, { useState } from "react";
import { motion } from "framer-motion";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "number" | "checkbox" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
};

export function ActionForm({
  title,
  sub,
  fields,
  onSubmit,
  submitLabel = "Выполнить",
  variant = "primary",
  openByDefault = false,
}: {
  title: string;
  sub?: string;
  fields: FieldSpec[];
  onSubmit: (values: Record<string, any>) => Promise<any>;
  submitLabel?: string;
  variant?: "primary" | "destructive";
  openByDefault?: boolean;
}) {
  const [open, setOpen] = useState(openByDefault);
  const [values, setValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    fields.forEach((f) => (init[f.name] = f.default ?? (f.type === "checkbox" ? false : "")));
    return init;
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const setField = (name: string, v: any) => setValues((s) => ({ ...s, [name]: v }));

  const submit = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await onSubmit(values);
      setResult({ ok: true, text: JSON.stringify(res) });
    } catch (e: any) {
      setResult({ ok: false, text: e?.response?.data?.error || e.message || "Ошибка" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card action-card">
      <div className="head" onClick={() => setOpen((v) => !v)}>
        <div>
          <div className="title">{title}</div>
          {sub && <div className="sub">{sub}</div>}
        </div>
        <span style={{ color: "var(--straw)" }}>{open ? "−" : "+"}</span>
      </div>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
        >
          <div className="body">
            {fields.map((f) => (
              <div className="field" key={f.name}>
                <label>{f.label}</label>
                {f.type === "checkbox" ? (
                  <button
                    className={"toggle" + (values[f.name] ? " on" : "")}
                    onClick={() => setField(f.name, !values[f.name])}
                  >
                    <span className="knob" />
                  </button>
                ) : f.type === "select" ? (
                  <select
                    value={values[f.name]}
                    onChange={(e) => setField(f.name, e.target.value)}
                  >
                    <option value="" disabled>выбрать</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    placeholder={f.placeholder}
                    value={values[f.name]}
                    onChange={(e) => setField(f.name, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="submit-row">
            <button
              className={"btn " + (variant === "destructive" ? "btn-destructive" : "btn-primary")}
              onClick={submit}
              disabled={loading}
            >
              {loading ? "Отправка…" : submitLabel}
            </button>
          </div>
          {result && (
            <div className={"result " + (result.ok ? "ok" : "err")}>
              {result.ok ? "✓ " : "✕ "}{result.text}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
