import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus, Wallet, CreditCard, Banknote, TrendingDown, TrendingUp, Trash2,
  ArrowRight, ArrowRightLeft, ArrowDownCircle, Landmark, PiggyBank, Repeat,
  Settings, Users, BarChart3, PieChart as PieChartIcon, X,Pencil,Search,
  Flame, ShieldCheck, Minus, CalendarDays,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "./supabaseClient";
import Login from "./Login";

function accFromDb(row) {
  return {
    id: row.id, name: row.name, type: row.type,
    statementDay: row.statement_day, dueDay: row.due_day,
    dueMonthOffset: row.due_month_offset ?? 1,
    includeNetWorth: row.include_net_worth,
    openingBalance: row.opening_balance || 0,
    creditLimit: row.credit_limit || 0,
  };
}
function accToDb(a) {
  return {
    name: a.name, type: a.type,
    statement_day: a.statementDay || null, due_day: a.dueDay || null,
    due_month_offset: a.dueMonthOffset ?? 1,
    include_net_worth: a.includeNetWorth,
    opening_balance: a.openingBalance || 0,
    credit_limit: a.creditLimit || 0,
  };
}

function txFromDb(row) {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    amount: row.amount,
    category: row.category,
    member: row.member,
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    vendor: row.vendor,
    note: row.note,
    recurringId: row.recurring_id,       // ← thêm dòng này
    splitGroupId: row.split_group_id,    // ← thêm dòng này
  };
}

function txToDb(t) {
  return {
    type: t.type,
    date: t.date,
    amount: t.amount,
    category: t.category || null,
    member: t.member || null,
    account_id: t.accountId || null,
    to_account_id: t.toAccountId || null,
    vendor: t.vendor || null,
    note: t.note || null,
    recurring_id: t.recurringId || null,  // ← thêm dòng này
    split_group_id: t.splitGroupId || null, // ← thêm dòng này
  };
}

function recFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    category: row.category,
    member: row.member,
    accountId: row.account_id,
    startDate: row.start_date,
    repeatValue: row.interval_value,
    repeatUnit: UNIT_APP_MAP[row.interval_unit] || "month",
    cycleCount: row.cycle_count || 0,
    doneCount: row.done_count || 0,
    principal: row.principal || 0,
    isInstallment: row.is_installment || false,
    isActive: row.is_active ?? true,        // ← thêm dòng này
  };
}
function recToDb(r) {
  return {
    name: r.name,
    amount: r.amount,
    category: r.category,
    member: r.member || null,
    account_id: r.accountId,
    start_date: r.startDate,
    interval_value: r.repeatValue,
    interval_unit: UNIT_DB_MAP[r.repeatUnit] || "thang",
    cycle_count: r.cycleCount ? Number(r.cycleCount) : 0,
    principal: r.principal ? Number(r.principal) : null,
    is_installment: r.isInstallment || false,
    is_active: r.isActive ?? true,           // ← thêm dòng này
  };
}

const COLORS = {
  bg: "#1B211A",
  surface: "#222A1E",
  surface2: "#2B3524",
  border: "#3A4632",
  accent: "#8BAE66",
  accentDark: "#628141",
  cream: "#EBD5AB",
  textPrimary: "#EDEAD9",
  textSecondary: "#9AAB89",
  textMuted: "#657059",
  expense: "#C1544A",
  transfer: "#7FA6C9",
  warn: "#D9A24B",
  over: "#C97B5C",
};
const PIE_COLORS = ["#8BAE66", "#EBD5AB", "#628141", "#C1544A", "#7FA6C9", "#B7C99A", "#9C7A3F", "#4F6A3B"];

const ACCOUNT_TYPES = [
  { value: "cash", label: "Tiền mặt", icon: Banknote },
  { value: "debit", label: "Thẻ ghi nợ / TK thanh toán", icon: Landmark },
  { value: "credit", label: "Thẻ tín dụng", icon: CreditCard },
  { value: "savings", label: "TK tích lũy", icon: PiggyBank },
  { value: "investment", label: "Đầu tư", icon: TrendingUp },
  { value: "loan", label: "Cho vay", icon: Users },
  { value: "payable", label: "Khoản phải trả", icon: ArrowDownCircle },
];

const REPEAT_UNITS = [{ v: "day", l: "ngày" }, { v: "week", l: "tuần" }, { v: "month", l: "tháng" }, { v: "year", l: "năm" }];
const UNIT_DB_MAP = { day: "ngay", week: "tuan", month: "thang", year: "nam" };
const UNIT_APP_MAP = { ngay: "day", tuan: "week", thang: "month", nam: "year" };

function pad(n) { return String(n).padStart(2, "0"); }
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
function fmtDateWithWeekday(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${WEEKDAYS[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function monthLabel(key) {
  const [y, m] = key.split("-");
  return `Tháng ${parseInt(m)}/${y}`;
}
function fmtVND(n) { return Math.round(n || 0).toLocaleString("vi-VN") + " đ"; }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function creditInstallmentDefaultDate(account) {
  const now = new Date();
  const day = Math.max(1, (account?.statementDay || 1) - 1);
  const d = new Date(now.getFullYear(), now.getMonth(), day);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function firstDayThisMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
function lastDayNextMonth() {
  const d = new Date();
  const end = new Date(d.getFullYear(), d.getMonth() + 2, 0); // ngày 0 của tháng+2 = ngày cuối của tháng+1
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

function getCashFlowDate(tx, account) {
  const txDate = new Date(tx.date + "T00:00:00");
  if (!account || account.type !== "credit") return txDate;
  const day = txDate.getDate();
  const belongsNext = day >= account.statementDay;
  const statementMonth = txDate.getMonth() + (belongsNext ? 1 : 0);
  const offset = account.dueMonthOffset ?? 1; // 0 = hạn TT cùng tháng chốt sao kê, 1 = hạn TT tháng sau
  const dueMonth = statementMonth + offset;
  return new Date(txDate.getFullYear(), dueMonth, account.dueDay);
}

function polarPt(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPathStr(cx, cy, r, startAngle, endAngle) {
  const start = polarPt(cx, cy, r, startAngle);
  const end = polarPt(cx, cy, r, endAngle);
  const large = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function occurrenceDate(r, account, n) {
  if (account && account.type === "credit" && r.repeatUnit === "month") {
    const start = new Date(r.startDate + "T00:00:00");
    const day = Math.max(1, (account.statementDay || 1) - 1);
    // Nếu ngày phát sinh đã qua mốc (statementDay-1) của tháng đó -> kỳ đầu tiên rơi vào tháng sau
    const anchorMonthOffset = start.getDate() > day ? 1 : 0;
    return new Date(start.getFullYear(), start.getMonth() + anchorMonthOffset + n * r.repeatValue, day);
  }
  const d = new Date(r.startDate + "T00:00:00");
  if (r.repeatUnit === "year") d.setFullYear(d.getFullYear() + n * r.repeatValue);
  else if (r.repeatUnit === "week") d.setDate(d.getDate() + n * r.repeatValue * 7);
  else if (r.repeatUnit === "day") d.setDate(d.getDate() + n * r.repeatValue);
  else d.setMonth(d.getMonth() + n * r.repeatValue);
  return d;
}

function nextDueDate(r, account) {
  return occurrenceDate(r, account, r.doneCount);
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function lastStatementCutoff(account) {
  const today = new Date();
  const day = today.getDate();
  if (day > account.statementDay) return new Date(today.getFullYear(), today.getMonth(), account.statementDay);
  return new Date(today.getFullYear(), today.getMonth() - 1, account.statementDay);
}

function dueDateForCutoff(cutoff, account) {
  const offset = account.dueMonthOffset ?? 1;
  return new Date(cutoff.getFullYear(), cutoff.getMonth() + offset, account.dueDay);
}

function dueCountUpTo(r, account, today) {
  let n = r.doneCount;
  while (
    (r.cycleCount === 0 || n < r.cycleCount) &&
    occurrenceDate(r, account, n) <= today
  ) {
    n++;
  }
  return n; // số lần "đáng lẽ đã ghi nhận" tính đến hôm nay
}

function inPeriod(dateStr, period) {
  if (period === "all") return true;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date(todayISO() + "T00:00:00");
  if (period === "today") return dateStr === todayISO();
  if (period === "week") { const diff = (today - d) / 86400000; return diff >= 0 && diff < 7; }
  if (period === "month") return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  return true;
}

function AccIcon({ type, size = 16, color }) {
  const found = ACCOUNT_TYPES.find((a) => a.value === type);
  const Icon = found ? found.icon : Wallet;
  return <Icon size={size} color={color} />;
}

function applyPercent(expr) {
  // A+B%, A-B% -> B% tính theo A (vd 800000-80% = 800000 - 800000*80/100)
  let out = expr.replace(/(-?\d+\.?\d*)([+\-])(\d+\.?\d*)%/g, (_, a, op, b) => `${a}${op}(${a}*${b}/100)`);
  // A*B%, A/B% -> B% quy về phân số (vd 800000*80% = 800000*0.8)
  out = out.replace(/(-?\d+\.?\d*)([*/])(\d+\.?\d*)%/g, (_, a, op, b) => `${a}${op}(${b}/100)`);
  // % còn lại đứng một mình (vd chỉ gõ "80%") -> quy về phân số
  out = out.replace(/(\d+\.?\d*)%/g, (_, b) => `(${b}/100)`);
  return out;
}

function evalExpr(expr) {
  if (!expr) return null;
  if (!/^[0-9+\-*/().%]*$/.test(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + applyPercent(expr) + ')')();
    return typeof result === "number" && isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function formatExprDisplay(expr) {
  return expr
    .replace(/\*/g, "×")
    .replace(/\//g, "÷")
    .replace(/-/g, "−")
    .replace(/\d+\.?\d*/g, (token) => {
      if (token.endsWith(".")) {
        const intPart = token.slice(0, -1);
        return (intPart ? Number(intPart).toLocaleString("vi-VN") : "0") + ",";
      }
      const [intPart, decPart] = token.split(".");
      const intFormatted = intPart ? Number(intPart).toLocaleString("vi-VN") : "0";
      return decPart !== undefined ? `${intFormatted},${decPart}` : intFormatted;
    });
}

function CalcKeypad({ onKey, onClear, onBackspace, onEqual, onDone }) {
  const keys = [
    ["7", "8", "9", "÷"],
    ["4", "5", "6", "×"],
    ["1", "2", "3", "−"],
  ];
  return (
    <div className="rounded-lg p-3" style={{ background: COLORS.surface2, border: "1px solid " + COLORS.border }}>
      <div className="grid grid-cols-4 gap-2">
        {keys.flat().map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onKey(k === "×" ? "*" : k === "÷" ? "/" : k === "−" ? "-" : k)}
            className="mono rounded-lg"
            style={{
              background: ["÷", "×", "−"].includes(k) ? COLORS.accentDark : COLORS.surface,
              color: COLORS.textPrimary,
              border: "1px solid " + COLORS.border,
              fontSize: 20,
              padding: "16px 0",
            }}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 mt-2">
        <button type="button" onClick={() => onKey(".")} className="mono rounded-lg" style={{ background: COLORS.surface, color: COLORS.textPrimary, border: "1px solid " + COLORS.border, fontSize: 20, padding: "16px 0" }}>,</button>
        <button type="button" onClick={() => onKey("0")} className="mono rounded-lg" style={{ background: COLORS.surface, color: COLORS.textPrimary, border: "1px solid " + COLORS.border, fontSize: 20, padding: "16px 0" }}>0</button>
        <button type="button" onClick={onBackspace} className="mono rounded-lg" style={{ background: COLORS.surface, color: COLORS.textPrimary, border: "1px solid " + COLORS.border, fontSize: 26, padding: "10px 0" }}>⌫</button>
        <button type="button" onClick={() => onKey("+")} className="mono rounded-lg" style={{ background: COLORS.accentDark, color: COLORS.textPrimary, border: "1px solid " + COLORS.border, fontSize: 20, padding: "16px 0" }}>+</button>
      </div>

      <div className="flex gap-2 mt-2">
        <button type="button" onClick={onClear} className="mono rounded-lg" style={{ background: COLORS.surface, color: COLORS.expense, border: "1px solid " + COLORS.border, fontSize: 20, padding: "14px 0", flex: 1 }}>C</button>
        <button type="button" onClick={() => onKey("%")} className="mono rounded-lg" style={{ background: COLORS.accentDark, color: COLORS.textPrimary, border: "1px solid " + COLORS.border, fontSize: 20, padding: "14px 0", flex: 1 }}>%</button>
        <button type="button" onClick={onEqual} className="mono rounded-lg" style={{ background: COLORS.accent, color: COLORS.bg, fontWeight: 700, fontSize: 18, padding: "14px 0", flex: 1 }}>=</button>
        <button type="button" onClick={onDone} className="sans rounded-lg" style={{ border: "1px solid " + COLORS.cream, color: COLORS.cream, fontSize: 15, padding: "14px 0", flex: 1 }}>Xong</button>
      </div>
    </div>
  );
}

function AmountInput({ value, onChange, placeholder = "0", align = "left" }) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);
  const wrapRef = useRef(null);

  function commitAndClose() {
    const result = evalExpr(expr);
    if (result !== null) onChange(String(Math.round(result * 100) / 100));
    setOpen(false);
    setExpr("");
    setJustEvaluated(false);
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) commitAndClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expr]);

  const display = open ? formatExprDisplay(expr) : (value ? Number(value).toLocaleString("vi-VN") : "");

  function handleKey(k) {
    if (/^\d$/.test(k) && justEvaluated) {
      // vừa bấm "=" xong, gõ số tiếp theo -> gộp thẳng vào số nguyên, bỏ dấu thập phân
      const lastSegment = expr.split(/[+\-*/]/).pop();
      const head = expr.slice(0, expr.length - lastSegment.length);
      const merged = lastSegment.includes(".") ? lastSegment.replace(".", "") : lastSegment;
      setExpr(head + merged + k);
      setJustEvaluated(false);
      return;
    }
    setJustEvaluated(false);
    if (k === ".") {
      const lastSegment = expr.split(/[+\-*/]/).pop();
      if (lastSegment.includes(".")) return; // đã có dấu . rồi, bỏ qua
    }
    setExpr(expr + k);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        inputMode="none"
        readOnly
        className="mono"
        style={{ textAlign: align }}
        placeholder={placeholder}
        value={display}
        onFocus={() => { setOpen(true); setExpr(value ? String(value) : ""); setJustEvaluated(false); }}
      />
      {open && (
        <div style={{ marginTop: 6 }}>
          <CalcKeypad
            onKey={handleKey}
            onClear={() => { setJustEvaluated(false); setExpr(""); }}
            onBackspace={() => { setJustEvaluated(false); setExpr((e) => e.slice(0, -1)); }}
            onEqual={() => {
              const result = evalExpr(expr);
              if (result !== null) {
                setExpr(String(Math.round(result * 100) / 100));
                setJustEvaluated(true);
              }
            }}
            onDone={commitAndClose}
          />
        </div>
      )}
    </div>
  );
}

function Chip({ label, active, onClick, onRemove }) {
  return (
    <button onClick={onClick} className="sans" style={{
      fontSize: 11.5, padding: "5px 10px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 5,
      border: "1px solid " + (active ? COLORS.cream : COLORS.border),
      background: active ? "#3A3624" : "transparent",
      color: active ? COLORS.cream : COLORS.textSecondary,
      flexShrink: 0, whiteSpace: "nowrap",
    }}>
      {label}
      {onRemove && <X size={11} onClick={(e) => { e.stopPropagation(); onRemove(); }} />}
    </button>
  );
}

function Section({ title, children, right, id, accent }) {
  return (
    <div className="pt-2" id={id}>
      <div
        className="flex items-center justify-between mb-3"
        style={accent ? { borderBottom: "1px solid " + COLORS.border, paddingBottom: 8 } : undefined}
      >
        <p
          className={accent ? "sans text-sm" : "sans text-xs"}
          style={{ color: accent ? COLORS.cream : COLORS.textSecondary, letterSpacing: 0.4, fontWeight: accent ? 600 : 400 }}
        >
          {title}
        </p>
        {right}
      </div>
      {children}
    </div>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div className="rounded-lg p-3 flex-1" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border }}>
      <p className="sans text-xs" style={{ color: COLORS.textSecondary }}>{label}</p>
      <p className="mono text-lg" style={{ color, fontWeight: 700 }}>{fmtVND(value)}</p>
    </div>
  );
}

 function CategoryRow({ label, amount, max, color, txList, onEditTx }) {
    const [open, setOpen] = useState(false);
    return (
      <div className="mb-2">
        <div className="flex items-center gap-3" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
          <span className="sans text-xs w-20" style={{ color: COLORS.textSecondary }}>{label}</span>
          <div className="flex-1 h-2 rounded-full" style={{ background: COLORS.surface2 }}>
            <div className="h-2 rounded-full" style={{ width: `${(amount / max) * 100}%`, background: color }} />
          </div>
          <span className="mono text-xs w-24 text-right">{fmtVND(amount)}</span>
        </div>
        {open && (
          <div className="pl-2 mt-1.5 space-y-1">
            {txList.map((t) => (
              <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onEditTx && onEditTx(t); }}>
                <span>{fmtDate(t.date)} · {t.note || t.vendor || "—"}</span>
                <span className="mono">{fmtVND(t.amount)}</span>
              </div>
            ))}
            {txList.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có giao dịch.</p>}
          </div>
        )}
      </div>
    );
  }

function ReconcileItemRow({ it, onSelectTx }) {
  const [open, setOpen] = useState(false);
  if (!it.isGroup) {
    return (
      <div
        className="flex justify-between sans text-xs"
        style={{ color: COLORS.textMuted, cursor: it.tx ? "pointer" : "default" }}
        onClick={(e) => { e.stopPropagation(); it.tx && onSelectTx && onSelectTx(it.tx); }}
      >
        <span>{it.label}</span>
        <span className="mono" style={{ color: it.sign === "-" ? COLORS.accent : COLORS.textMuted }}>{it.sign === "-" ? "− " : "+ "}{fmtVND(it.amount)}</span>
      </div>
    );
  }
  return (
    <div>
      <div className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <span>{it.label} <span style={{ fontSize: 10 }}>· {it.children.length} khoản</span></span>
        <span className="mono" style={{ color: it.sign === "-" ? COLORS.accent : COLORS.textMuted }}>{it.sign === "-" ? "− " : "+ "}{fmtVND(it.amount)}</span>
      </div>
            {open && (
        <div className="mt-1 space-y-1" style={{ paddingLeft: 10, borderLeft: "2px solid " + COLORS.border }}>
          {it.children.map((c, i) => (
            <div
              key={i}
              className="flex justify-between sans text-xs"
              style={{ color: COLORS.textSecondary, cursor: c.tx ? "pointer" : "default" }}
              onClick={(e) => { e.stopPropagation(); c.tx && onSelectTx && onSelectTx(c.tx); }}
            >
              <span>{c.label}</span>
              <span className="mono" style={{ color: COLORS.cream }}>{fmtVND(c.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReconcileRow({ label, value, items, onSelectTx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg p-3" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border, cursor: items ? "pointer" : "default" }} onClick={() => items && setOpen(!open)}>
      <div className="flex items-center justify-between">
        <span className="sans text-xs" style={{ color: COLORS.textSecondary }}>{label}</span>
        <span className="mono text-sm" style={{ color: COLORS.cream }}>{fmtVND(value)}</span>
      </div>
      {open && items && (
        <div className="mt-2 space-y-1" style={{ borderTop: "1px solid " + COLORS.border, paddingTop: 8 }}>
          {items.map((it, i) => (
            <ReconcileItemRow key={i} it={it} onSelectTx={onSelectTx} />
          ))}
          {items.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có giao dịch.</p>}
        </div>
      )}
    </div>
  );
}


function RecurringItemCard({ r, acc, done, pending, txList, unitLabel, onEdit, onRemove, onToggleActive, onLog, onEditTx }) {
  const [open, setOpen] = useState(false);
  const inactive = r.isActive === false;
  return (
    <div className="rounded-lg p-3" style={{
      background: COLORS.surface,
      border: "1px solid " + (pending ? COLORS.expense : COLORS.border),
      opacity: inactive ? 0.55 : 1,
    }}>
      <div className="flex items-center justify-between" style={{ cursor: "pointer" }} onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-2">
          <Repeat size={15} style={{ color: COLORS.cream }} />
          <div>
            <p className="sans text-sm">
              {r.name}
              {inactive && <span style={{ color: COLORS.textMuted, fontSize: 11 }}> · Đã tạm dừng</span>}
              {!inactive && pending && <span style={{ color: COLORS.expense, fontSize: 11 }}> · Đến hạn</span>}
            </p>
            <p className="sans text-xs" style={{ color: COLORS.textMuted }}>
              {r.category} · mỗi {r.repeatValue} {unitLabel(r.repeatUnit)}/lần · từ {fmtDate(r.startDate)} · {r.cycleCount > 0 ? `${r.doneCount}/${r.cycleCount} chu kỳ` : `đã ghi ${r.doneCount} lần, không giới hạn`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onEdit(r)} style={{ color: COLORS.textMuted }}><Pencil size={13} /></button>
          <button onClick={() => onToggleActive(r)} className="sans text-xs px-2 py-1 rounded"
            style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}>
            {inactive ? "Kích hoạt lại" : "Tạm dừng"}
          </button>
          <button onClick={() => onRemove(r.id)} style={{ color: COLORS.textMuted }}><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="mono text-xs">{fmtVND(r.amount)} · {acc?.name}</span>
        <button onClick={(e) => { e.stopPropagation(); onLog(r); }} disabled={done || inactive} className="sans text-xs px-2 py-1 rounded"
          style={{ border: "1px solid " + (done || inactive ? COLORS.textMuted : COLORS.accent), color: done || inactive ? COLORS.textMuted : COLORS.accent }}>
          {done ? "Đã hoàn thành" : "Ghi nhận"}
        </button>
      </div>

      {open && (
        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px dashed " + COLORS.border }}>
          {txList.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Chưa có giao dịch nào được ghi nhận.</p>}
          {txList.map((t) => (
            <div key={t.id} className="flex items-center justify-between sans text-xs" style={{ color: COLORS.textMuted }}>
              <span>{fmtDate(t.date)} · {t.category}</span>
              <div className="flex items-center gap-2">
                <span className="mono" style={{ color: COLORS.textSecondary }}>{fmtVND(t.amount)}</span>
                <button onClick={() => onEditTx(t)} style={{ color: COLORS.textMuted }}><Pencil size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountGroupRow({ group, onEditTx, onEditGroup }) {
  const [open, setOpen] = useState(false);
  const total = group.items.reduce((s, t) => s + t.amount, 0);
  return (
    <div>
      <div className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
        <span>{fmtDate(group.items[0].date)} · {group.vendor || group.note || "Hóa đơn gộp"} <span style={{ fontSize: 10 }}>· {group.items.length} khoản</span></span>
        <span className="mono" style={{ color: COLORS.expense }}>-{fmtVND(total)}</span>
      </div>
      {open && (
        <div className="mt-1 space-y-1" style={{ paddingLeft: 10, borderLeft: "2px solid " + COLORS.border }}>
          {group.items.map((t) => (
            <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textSecondary, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onEditTx && onEditTx(t); }}>
              <span>{t.category}{t.note ? ` · ${t.note}` : ""}</span>
              <span className="mono" style={{ color: COLORS.cream }}>{fmtVND(t.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountReportCard({ account, data, balance, txList, onEditTx, onEditGroup }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg p-3" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border, cursor: "pointer" }} onClick={() => setOpen(!open)}>
      <div className="flex items-center gap-2 mb-2"><AccIcon type={account.type} size={15} color={COLORS.cream} /><span className="sans text-sm">{account.name}</span></div>
      <div className="sans text-xs" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
        <span style={{ color: COLORS.accent, textAlign: "left" }}>Thu: {fmtVND(data.income)}</span>
        <span style={{ color: COLORS.expense, textAlign: "center" }}>Chi: {fmtVND(data.expense)}</span>
        <span className="mono" style={{ color: COLORS.cream, textAlign: "right" }}>Số dư: {fmtVND(balance)}</span>
      </div>
      {open && (
        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px dashed " + COLORS.border }} onClick={(e) => e.stopPropagation()}>
          {txList.map((t) => (
            t.isGroup ? (
              <AccountGroupRow key={t.id} group={t} onEditTx={onEditTx} onEditGroup={onEditGroup} />
            ) : (
              <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted, cursor: "pointer" }} onClick={() => onEditTx && onEditTx(t)}>
                <span>{fmtDate(t.date)} · {t.category || (t.type === "transfer" ? "Chuyển khoản" : "—")}{t.note ? ` · ${t.note}` : ""}</span>
                <span className="mono" style={{ color: t.type === "income" ? COLORS.accent : t.type === "transfer" ? COLORS.transfer : COLORS.expense, flexShrink: 0, marginLeft: 8 }}>
                  {t.type === "income" ? "+" : t.type === "transfer" ? "" : "-"}{fmtVND(t.amount)}
                </span>
              </div>
            )
          ))}
          {txList.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có giao dịch.</p>}
        </div>
      )}
    </div>
  );
}

function MemberReportCard({ member, data, txList, onEditTx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg p-3" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border, cursor: "pointer" }} onClick={() => setOpen(!open)}>
      <p className="sans text-sm mb-2">{member}</p>
      <div className="sans text-xs" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <span style={{ color: COLORS.accent, textAlign: "left" }}>Thu: {fmtVND(data.income)}</span>
        <span style={{ color: COLORS.expense, textAlign: "right" }}>Chi: {fmtVND(data.expense)}</span>
      </div>
      {open && (
        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px dashed " + COLORS.border }}>
          {txList.map((t) => (
            <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onEditTx && onEditTx(t); }}>
              <span>{fmtDate(t.date)} · {t.category}{t.note ? ` · ${t.note}` : ""}</span>
              <span className="mono" style={{ color: t.type === "income" ? COLORS.accent : COLORS.expense, flexShrink: 0, marginLeft: 8 }}>
                {t.type === "income" ? "+" : "-"}{fmtVND(t.amount)}
              </span>
            </div>
          ))}
          {txList.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có giao dịch.</p>}
        </div>
      )}
    </div>
  );
}

function MonthReportCard({ monthKeyStr, data, txList, onEditTx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg p-3" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border, cursor: "pointer" }} onClick={() => setOpen(!open)}>
      <div className="flex items-center justify-between mb-2">
        <span className="sans text-sm" style={{ fontWeight: 600 }}>{monthLabel(monthKeyStr)}</span>
        <span className="mono text-sm" style={{ color: data.income - data.expense >= 0 ? COLORS.accent : COLORS.expense }}>
          {data.income - data.expense >= 0 ? "+" : ""}{fmtVND(data.income - data.expense)}
        </span>
      </div>
      <div className="sans text-xs" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <span style={{ color: COLORS.accent, textAlign: "left" }}>Thu: {fmtVND(data.income)}</span>
        <span style={{ color: COLORS.expense, textAlign: "right" }}>Chi: {fmtVND(data.expense)}</span>
      </div>
      {open && (
        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px dashed " + COLORS.border }}>
          {txList.map((t) => (
            <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onEditTx && onEditTx(t); }}>
              <span>{fmtDate(t.date)} · {t.note || t.category}</span>
              <span className="mono" style={{ color: t.type === "income" ? COLORS.accent : COLORS.expense }}>
                {t.type === "income" ? "+" : "-"}{fmtVND(t.amount)}
              </span>
            </div>
          ))}
          {txList.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có giao dịch.</p>}
        </div>
      )}
    </div>
  );
}

function BudgetPaceView({ budgets, currentMonthExpenseByCat, lastMonthExpenseByCat, txs, onEdit, onRemove }) {
  const [dailyOverride, setDailyOverride] = useState({});
  const statusColor = (status) => (status === "over" ? COLORS.over : status === "warn" ? COLORS.warn : COLORS.accent);
  const today = new Date();
  const dayOfMonth = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - dayOfMonth);
  const idealPct = (dayOfMonth / daysInMonth) * 100;

  const paceColor = (mult) => (mult >= 1.3 ? COLORS.expense : mult >= 1.0 ? COLORS.warn : COLORS.accent);
  const paceLabel = (mult) =>
    mult >= 1.3 ? `Nhanh hơn kế hoạch ${mult.toFixed(1)}x`
    : mult >= 1.05 ? "Nhỉnh hơn kế hoạch"
    : mult >= 0.85 ? "Đúng nhịp"
    : "Chậm hơn kế hoạch";
  const PaceIcon = ({ mult, size = 12 }) =>
    mult >= 1.05 ? <TrendingUp size={size} /> : mult >= 0.85 ? <Minus size={size} /> : <TrendingDown size={size} />;

  const enriched = useMemo(() => {
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
  return budgets.map((b) => {
    const spent = currentMonthExpenseByCat[b.category] || 0;
    const lastMonthSpent = lastMonthExpenseByCat[b.category] || 0;
    const limit = b.limit || 0;
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    const paceMult = idealPct > 0 ? pct / idealPct : 0;
    const dailySafe = (limit - spent) / daysLeft;
    const status = pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok";
    const daySet = new Set(
      txs.filter((t) => t.type === "expense" && t.category === b.category && new Date(t.date + "T00:00:00") >= cutoff)
         .map((t) => t.date)
    );
    const freq = daySet.size / 30;
    const autoIsDaily = freq >= 0.4;
    const isDaily = dailyOverride[b.category] ?? autoIsDaily;
    return { ...b, spent, lastMonthSpent, limit, pct, paceMult, dailySafe, status, isDaily };
  }).sort((a, b2) => b2.paceMult - a.paceMult);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [budgets, currentMonthExpenseByCat, lastMonthExpenseByCat, txs, idealPct, daysLeft, dailyOverride]);
 
  if (budgets.length === 0) {
    return <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Chưa có ngân sách nào — thêm trong Cài đặt.</p>;
  }

  const totalLimit = budgets.reduce((s, b) => s + (b.limit || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (currentMonthExpenseByCat[b.category] || 0), 0);
  const totalPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
  const totalDailySafe = (totalLimit - totalSpent) / daysLeft;

  const mostUrgent = enriched.find((b) => b.spent > 0) || null;
  const rest = enriched.filter((b) => b !== mostUrgent);

  const cx = 140, cy = 120, r = 96;
  const gaugeColor = totalPct >= 100 ? COLORS.over : totalPct >= idealPct ? COLORS.warn : COLORS.accent;
  const valueAngle = 180 + Math.min(100, totalPct) * 1.8;
  const idealAngle = 180 + Math.min(100, idealPct) * 1.8;
  const idealTickOuter = polarPt(cx, cy, r + 12, idealAngle);
  const idealTickInner = polarPt(cx, cy, r - 6, idealAngle);

  return (
    <div>
      <div className="rounded-lg" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border, borderRadius: 14, padding: "18px 16px 8px", marginBottom: 16 }}>
        <svg viewBox="0 0 280 145" width="100%" height="150">
          <path d={arcPathStr(cx, cy, r, 180, 360)} fill="none" stroke={COLORS.surface2} strokeWidth={16} strokeLinecap="round" />
          <path d={arcPathStr(cx, cy, r, 180, valueAngle)} fill="none" stroke={gaugeColor} strokeWidth={16} strokeLinecap="round" />
          <text x={cx} y={cy - 20} textAnchor="middle" fontSize="26" fontWeight="700" fill={gaugeColor} fontFamily="'JetBrains Mono', monospace">{Math.round(totalPct)}%</text>
          <text x={cx} y={cy - 2} textAnchor="middle" fontSize="10.5" fill={COLORS.textMuted} fontFamily="system-ui">đã dùng · mốc lý tưởng hôm nay {Math.round(idealPct)}%</text>
        </svg>
        <div className="sans" style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: COLORS.textMuted, padding: "0 6px 10px" }}>
          <span>{fmtVND(totalSpent)} / {fmtVND(totalLimit)}</span>
          <span className="mono" style={{ color: totalDailySafe >= 0 ? COLORS.accent : COLORS.expense, fontWeight: 700 }}>
            {totalDailySafe >= 0 ? `An toàn ~${fmtVND(totalDailySafe)}/ngày` : `Vượt ${fmtVND(-totalDailySafe)}/ngày`}
          </span>
        </div>
      </div>

      {!mostUrgent && (
        <div className="rounded-lg" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border, borderRadius: 14, padding: 16, marginBottom: 16, textAlign: "center" }}>
          <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Chưa có chi tiêu nào được ghi nhận trong tháng này.</p>
        </div>
      )}

      {mostUrgent && (
        <div className="rounded-lg" style={{
          background: "linear-gradient(135deg, #332A1F 0%, " + COLORS.surface + " 70%)",
          border: "1.5px solid " + paceColor(mostUrgent.paceMult), borderRadius: 14, padding: 16, marginBottom: 16,
        }}>
          <div className="sans" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: paceColor(mostUrgent.paceMult), marginBottom: 8, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase" }}>
            <Flame size={13} /> Cần chú ý nhất
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>{mostUrgent.category}</span>
            <div className="flex items-center gap-2">
              <span className="mono" style={{ fontSize: 13, color: paceColor(mostUrgent.paceMult), fontWeight: 700 }}>{Math.round(mostUrgent.pct)}%</span>
              <button onClick={() => onEdit(mostUrgent)} style={{ color: COLORS.textMuted }}><Pencil size={13} /></button>
              <button onClick={() => onRemove(mostUrgent.category)} style={{ color: COLORS.textMuted }}><Trash2 size={13} /></button>
            </div>
          </div>
          <button
            onClick={() => setDailyOverride((p) => ({ ...p, [mostUrgent.category]: !mostUrgent.isDaily }))}
            className="sans"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: COLORS.textMuted, border: "1px solid " + COLORS.border, borderRadius: 999, padding: "2px 8px", marginBottom: 8, background: "transparent" }}
          >
            {mostUrgent.isDaily ? <Repeat size={10} /> : <CalendarDays size={10} />}
            {mostUrgent.isDaily ? "Chi tiêu hằng ngày" : "Không thường xuyên"}
          </button>
            <div style={{ height: 8, borderRadius: 999, background: COLORS.surface2, overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", width: `${Math.min(100, mostUrgent.pct)}%`, background: paceColor(mostUrgent.paceMult) }} />
            </div>
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.textSecondary, marginBottom: 8 }}>
              <span>{fmtVND(mostUrgent.spent)} / {fmtVND(mostUrgent.limit)}</span>
              <span style={{ color: COLORS.textMuted }}>T.trước: {fmtVND(mostUrgent.lastMonthSpent)}</span>
            </div>
            <p className="sans" style={{ fontSize: 12.5, color: COLORS.textSecondary, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
              <PaceIcon mult={mostUrgent.paceMult} /> {paceLabel(mostUrgent.paceMult)}
            </p>
          <p className="sans" style={{ fontSize: 12.5, color: COLORS.textPrimary }}>
            {mostUrgent.dailySafe >= 0
              ? (mostUrgent.isDaily
                  ? <>Còn được chi <span className="mono" style={{ color: COLORS.accent, fontWeight: 700 }}>{fmtVND(mostUrgent.dailySafe)}</span>/ngày trong {daysLeft} ngày còn lại</>
                  : <>Còn <span className="mono" style={{ color: COLORS.accent, fontWeight: 700 }}>{fmtVND(mostUrgent.limit - mostUrgent.spent)}</span> cho {daysLeft} ngày còn lại của tháng</>)
              : <>Đã vượt <span className="mono" style={{ color: COLORS.expense, fontWeight: 700 }}>{fmtVND(mostUrgent.spent - mostUrgent.limit)}</span> — nên dừng chi cho mục này</>}
          </p>
        </div>
      )}

      {rest.length > 0 && <p className="sans text-xs" style={{ color: COLORS.textSecondary, marginBottom: 8 }}>Xếp hạng theo tốc độ chi (nhanh nhất trước)</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rest.map((b) => (
          <div key={b.category} className="rounded-lg" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span className="sans" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                {b.category}
                <button
                  onClick={() => setDailyOverride((p) => ({ ...p, [b.category]: !b.isDaily }))}
                  className="sans"
                  style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, color: COLORS.textMuted, border: "1px solid " + COLORS.border, borderRadius: 999, padding: "1px 6px", background: "transparent" }}
                >
                  {b.isDaily ? <Repeat size={9} /> : <CalendarDays size={9} />}
                  {b.isDaily ? "Hằng ngày" : "Không thường xuyên"}
                </button>
              </span>
              <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                <span className="sans" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: paceColor(b.paceMult) }}>
                  <PaceIcon mult={b.paceMult} size={11} /> {paceLabel(b.paceMult)}
                </span>
                <button onClick={() => onEdit(b)} style={{ color: COLORS.textMuted }}><Pencil size={12} /></button>
                <button onClick={() => onRemove(b.category)} style={{ color: COLORS.textMuted }}><Trash2 size={12} /></button>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: COLORS.surface2, overflow: "hidden", marginTop: 6, marginBottom: 6 }}>
              <div style={{ height: "100%", width: `${Math.min(100, b.pct)}%`, background: paceColor(b.paceMult) }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="mono" style={{ fontSize: 11, color: COLORS.textMuted }}>{fmtVND(b.spent)} / {fmtVND(b.limit)}</span>
              <span className="mono" style={{ fontSize: 11, color: b.dailySafe >= 0 ? COLORS.textSecondary : COLORS.expense }}>
                {b.dailySafe >= 0
                  ? (b.isDaily ? `${fmtVND(b.dailySafe)}/ngày còn lại` : `còn ${fmtVND(b.limit - b.spent)}/${daysLeft} ngày còn lại`)
                  : (b.isDaily ? `vượt ${fmtVND(-b.dailySafe)}/ngày` : `vượt ${fmtVND(b.spent - b.limit)}`)}
              </span>
            </div>
            <p className="mono" style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2 }}>Tháng trước: {fmtVND(b.lastMonthSpent)}</p>
          </div>
        ))}
      </div>

      <div className="sans" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: COLORS.textMuted, marginTop: 14, justifyContent: "center", textAlign: "center" }}>
        <ShieldCheck size={12} style={{ flexShrink: 0 }} /> Nhãn "Hằng ngày" tự nhận diện theo tần suất giao dịch, bấm vào để đổi tay
      </div>
    </div>
  );
}

function SplitGroupRow({ group, onEditTx, onEditGroup }) {
  const [open, setOpen] = useState(false);
  const total = group.items.reduce((s, t) => s + t.amount, 0);
  return (
    <div className="ledger-line" style={{ cursor: "pointer" }}>
      <div className="py-3 flex items-center justify-between" style={{ gap: 12 }} onClick={() => setOpen(!open)}>
        <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: COLORS.textMuted, flexShrink: 0 }}><AccIcon type={group.accType} /></div>
          <div style={{ minWidth: 0 }}>
            <p className="sans text-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {group.vendor || group.note || "Hóa đơn gộp"} <span style={{ color: COLORS.textMuted, fontSize: 11 }}>· {group.items.length} khoản</span>
            </p>
            <p className="sans text-xs" style={{ color: COLORS.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {group.items.map((t) => t.category).join(", ")}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
          <span className="mono text-sm" style={{ color: COLORS.expense }}>-{fmtVND(total)}</span>
          <span className="sans text-xs" style={{ color: COLORS.textMuted }}>{group.accName}</span>
        </div>
      </div>
      {open && (
        <div className="space-y-1 pb-2" style={{ paddingLeft: 12 }}>
          {group.items.map((t) => (
            <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onEditTx(t); }}>
              <span>{t.category}{t.member ? " · " + t.member : ""}{t.note ? " · " + t.note : ""}</span>
              <span className="mono" style={{ color: COLORS.textSecondary }}>{fmtVND(t.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [members, setMembers] = useState([]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [expenseCats, setExpenseCats] = useState([]);
  const [incomeCats, setIncomeCats] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [txs, setTxs] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [originalSplitIds, setOriginalSplitIds] = useState([]);
  const [editingAccId, setEditingAccId] = useState(null);
  const [editingBudgetCat, setEditingBudgetCat] = useState(null);
  const [detailTx, setDetailTx] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const [newAcc, setNewAcc] = useState({ name: "", type: "debit", statementDay: 15, dueDay: 5, dueMonthOffset: 1, includeNetWorth: true, openingBalance: "", creditLimit: "" });

  const [tab, setTab] = useState("nhap");
  const [entryType, setEntryType] = useState("expense");
  const [txPeriod, setTxPeriod] = useState("month");
  const [reportView, setReportView] = useState("danhmuc");
  const [reconcileAccId, setReconcileAccId] = useState("");
  const [selectedExpenseCat, setSelectedExpenseCat] = useState(null);
  const [selectedIncomeCat, setSelectedIncomeCat] = useState(null);
  const [dateBasis, setDateBasis] = useState("phatsinh");
  const [reportFrom, setReportFrom] = useState(firstDayThisMonth());
  const [reportTo, setReportTo] = useState(lastDayNextMonth());

    const accById = (id) => accounts.find((a) => a.id === id);

  function groupSplitTxs(list) {
    const seen = new Map();
    const merged = [];
    list.forEach((t) => {
      if (!t.splitGroupId) { merged.push(t); return; }
      if (seen.has(t.splitGroupId)) {
        seen.get(t.splitGroupId).items.push(t);
      } else {
        const acc = accById(t.accountId);
        const g = { isGroup: true, id: t.splitGroupId, accountId: t.accountId, accName: acc?.name, accType: acc?.type, vendor: t.vendor, note: t.note, items: [t] };
        seen.set(t.splitGroupId, g);
        merged.push(g);
      }
    });
    return merged;
  }

  const [form, setForm] = useState({
    date: todayISO(), amount: "", category: "", member: "",
    accountId: "", vendor: "", note: "", fromAccountId: "", toAccountId: "",
    });
  const [isSplitEntry, setIsSplitEntry] = useState(false);
  const [splitLines, setSplitLines] = useState([{ id: "l0", category: "", member: "", amount: "", note: "" }]);

  const [newCatType, setNewCatType] = useState("expense");
  const [newCatName, setNewCatName] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newRecurring, setNewRecurring] = useState({ name: "", amount: "", category: "", member: "", accountId: "", startDate: todayISO(), repeatValue: 1, repeatUnit: "month", cycleCount: "", principal: "", isInstallment: false });
  const [editingRecurringId, setEditingRecurringId] = useState(null);
  const [newBudget, setNewBudget] = useState({ category: "", limit: "" });
  
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    setSession(session);
    setCheckingAuth(false);
  });
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
  });
  return () => subscription.unsubscribe();
}, []);

// Tự tính số tiền mỗi kỳ = nguyên giá / số chu kỳ
useEffect(() => {
  if (newRecurring.isInstallment && newRecurring.principal && Number(newRecurring.cycleCount) > 0) {
    const per = Math.round(Number(newRecurring.principal) / Number(newRecurring.cycleCount));
    setNewRecurring((r) => ({ ...r, amount: String(per) }));
  }
}, [newRecurring.isInstallment, newRecurring.principal, newRecurring.cycleCount]);

const autoRecurringRanRef = useRef(false);

useEffect(() => {
  if (loadingData || autoRecurringRanRef.current) return;
  if (recurring.length === 0 || accounts.length === 0) return;
  autoRecurringRanRef.current = true; // chỉ chạy 1 lần/phiên

  (async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let loggedCount = 0;

    for (const r of recurring) {
      if (r.isActive === false) continue; 
      const acc = accounts.find((a) => a.id === r.accountId);
      const expected = dueCountUpTo(r, acc, today);
      let done = r.doneCount;

      while (done < expected) {
        const occDate = occurrenceDate(r, acc, done);
        const iso = `${occDate.getFullYear()}-${pad(occDate.getMonth() + 1)}-${pad(occDate.getDate())}`;
        const ok = await logRecurring(r, iso, done);   // truyền rõ occurrenceIndex = done
        if (!ok) break;
        done++;
        loggedCount++;
      }
    }
    if (loggedCount > 0) showToast(`Đã tự động ghi nhận ${loggedCount} khoản định kỳ`);
  })();
}, [loadingData, recurring, accounts]);

useEffect(() => {
  if (!session) return;
  Promise.all([
    supabase.from("transactions").select("*").order("date", { ascending: false }),
    supabase.from("accounts").select("*").order("created_at"),
    supabase.from("categories").select("*"),
    supabase.from("members").select("*"),
    supabase.from("vendors").select("*"),
    supabase.from("recurring_items").select("*"),
    supabase.from("budgets").select("*"),
  ]).then(([tx, acc, cat, mem, ven, rec, bud]) => {
    if (tx.data) setTxs(tx.data.map(txFromDb));
    if (acc.data) setAccounts(acc.data.map(accFromDb));
    if (cat.data) {
      setExpenseCats(cat.data.filter((c) => c.type === "expense").map((c) => c.name));
      setIncomeCats(cat.data.filter((c) => c.type === "income").map((c) => c.name));
    }
    if (mem.data) setMembers(mem.data.map((m) => m.name));
    if (ven.data) setVendors(ven.data.map((v) => v.name));
    if (rec.data) setRecurring(rec.data.map(recFromDb));
    if (bud.data) setBudgets(bud.data.map((b) => ({ category: b.category, limit: b.monthly_limit, id: b.id })));
    setLoadingData(false);
  });
}, [session]);

useEffect(() => {
  if (accounts.length && !form.accountId) {
    setForm((f) => ({ ...f, accountId: accounts[0].id, fromAccountId: accounts[0].id, toAccountId: accounts[1]?.id || accounts[0].id }));
  }
  if (accounts.length && !newRecurring.accountId) {
    setNewRecurring((r) => ({ ...r, accountId: accounts[0].id }));
  }
}, [accounts]);

useEffect(() => {
  if (newRecurring.isInstallment && newRecurring.principal && Number(newRecurring.cycleCount) > 0) {
    const per = Math.round(Number(newRecurring.principal) / Number(newRecurring.cycleCount));
    setNewRecurring((r) => ({ ...r, amount: String(per) }));
  }
}, [newRecurring.isInstallment, newRecurring.principal, newRecurring.cycleCount]);

    async function saveTx() {
  if (!form.amount || Number(form.amount) <= 0) return;

  if (entryType === "expense" && isSplitEntry && editingGroupId) {
    const splitSum = splitLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const valid = splitSum === Number(form.amount) && splitLines.every((l) => Number(l.amount) > 0 && l.category);
    if (!valid) { showToast("Tổng các khoản phải khớp với tổng hóa đơn"); return; }

    const keptIds = splitLines.map((l) => l.id).filter((id) => originalSplitIds.includes(id));
    const removedIds = originalSplitIds.filter((id) => !keptIds.includes(id));
    const newLines = splitLines.filter((l) => !originalSplitIds.includes(l.id));
    const updatedLines = splitLines.filter((l) => originalSplitIds.includes(l.id));

    if (removedIds.length) {
      const { error } = await supabase.from("transactions").delete().in("id", removedIds);
      if (error) { console.error(error); showToast("Không xóa được khoản cũ"); return; }
    }

    let updatedRows = [];
    for (const l of updatedLines) {
      const payload = txToDb({
        type: "expense", date: form.date, amount: Number(l.amount), category: l.category,
        member: l.member, accountId: form.accountId, vendor: form.vendor, note: l.note || form.note,
        splitGroupId: editingGroupId,
      });
      const { data, error } = await supabase.from("transactions").update(payload).eq("id", l.id).select().single();
      if (error) { console.error(error); showToast("Không cập nhật được 1 khoản"); return; }
      updatedRows.push(data);
    }

    let insertedRows = [];
    if (newLines.length) {
      const payloads = newLines.map((l) => txToDb({
        type: "expense", date: form.date, amount: Number(l.amount), category: l.category,
        member: l.member, accountId: form.accountId, vendor: form.vendor, note: l.note || form.note,
        splitGroupId: editingGroupId,
      }));
      const { data, error } = await supabase.from("transactions").insert(payloads).select();
      if (error) { console.error(error); showToast("Không thêm được khoản mới"); return; }
      insertedRows = data;
    }

    setTxs((prev) => {
      const withoutOld = prev.filter((t) => !originalSplitIds.includes(t.id));
      return [...insertedRows.map(txFromDb), ...updatedRows.map(txFromDb), ...withoutOld];
    });
    resetEntryForm();
    showToast("Đã cập nhật hóa đơn gộp");
    setEntryOpen(false);
    return;
  }

  if (entryType === "expense" && isSplitEntry && !editingId && !editingGroupId) {
    const splitSum = splitLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const valid = splitSum === Number(form.amount) && splitLines.every((l) => Number(l.amount) > 0 && l.category);
    if (!valid) { showToast("Tổng các khoản phải khớp với tổng hóa đơn"); return; }

    const groupId = crypto.randomUUID();
    const payloads = splitLines.map((l) => txToDb({
      type: "expense", date: form.date, amount: Number(l.amount), category: l.category,
      member: l.member, accountId: form.accountId, vendor: form.vendor, note: l.note || form.note,
      splitGroupId: groupId,
    }));
    const { data, error } = await supabase.from("transactions").insert(payloads).select();
    if (error) { console.error(error); showToast("Không lưu được hóa đơn gộp"); return; }
    setTxs((prev) => [...data.map(txFromDb), ...prev]);
    resetEntryForm();
    showToast(`Đã lưu hóa đơn gộp (${payloads.length} khoản)`);
    setEntryOpen(false);
    return;
  }

  let payload;
  if (entryType === "transfer") {
    if (form.fromAccountId === form.toAccountId) return;
    payload = txToDb({ type: "transfer", date: form.date, amount: Number(form.amount), accountId: form.fromAccountId, toAccountId: form.toAccountId, note: form.note });
  } else {
    payload = txToDb({ type: entryType, date: form.date, amount: Number(form.amount), category: form.category, member: form.member, accountId: form.accountId, vendor: form.vendor, note: form.note });
  }
  if (editingId) {
    const { data, error } = await supabase.from("transactions").update(payload).eq("id", editingId).select().single();
    if (error) { console.error(error); return; }
    setTxs(txs.map((t) => t.id === editingId ? txFromDb(data) : t));
    setEditingId(null);
    showToast("Đã cập nhật giao dịch");
    setEntryOpen(false);
  } else {
    const { data, error } = await supabase.from("transactions").insert(payload).select().single();
    if (error) { console.error(error); return; }
    setTxs([txFromDb(data), ...txs]);
  }
  setForm({ ...form, amount: "", note: "", vendor: "" });
  showToast("Đã lưu giao dịch");
  setEntryOpen(false);
}

  async function removeTx(id) {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { console.error(error); return; }
    setTxs(txs.filter((t) => t.id !== id));
    showToast("Đã xóa giao dịch");
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  }

    function startEditTx(t) {
    setEditingId(t.id);
    setEntryType(t.type);
    setForm({
      date: t.date, amount: String(t.amount), category: t.category || "", member: t.member || "",
      accountId: t.accountId || "", vendor: t.vendor || "", note: t.note || "",
      fromAccountId: t.accountId || "", toAccountId: t.toAccountId || "",
    });
    setEntryOpen(true);
  }

  function startEditSplitGroup(group) {
    const total = group.items.reduce((s, t) => s + t.amount, 0);
    setEditingId(null);
    setEditingGroupId(group.id);
    setOriginalSplitIds(group.items.map((t) => t.id));
    setEntryType("expense");
    setIsSplitEntry(true);
    setForm({
      date: group.items[0].date, amount: String(total), category: "", member: "",
      accountId: group.accountId || "", vendor: group.vendor || "", note: group.note || "",
      fromAccountId: "", toAccountId: "",
    });
    setSplitLines(group.items.map((t) => ({
      id: t.id, category: t.category || "", member: t.member || "", amount: String(t.amount), note: t.note || "",
    })));
    setEntryOpen(true);
  }

  function resetEntryForm() {
    setEditingId(null);
    setEditingGroupId(null);
    setOriginalSplitIds([]);
    setEntryType("expense");
    setForm({
      date: todayISO(), amount: "", category: "", member: members[0] || "",
      accountId: accounts[0]?.id || "", vendor: "", note: "",
      fromAccountId: accounts[0]?.id || "", toAccountId: accounts[1]?.id || accounts[0]?.id || "",
    });
    setIsSplitEntry(false);
    setSplitLines([{ id: "l0", category: expenseCats[0] || "", member: members[0] || "", amount: "", note: "" }]);
  }

  async function removeCategory(name, type) {
  const { error } = await supabase.from("categories").delete().eq("name", name).eq("type", type);
  if (error) { console.error(error); return; }
  if (type === "expense") setExpenseCats(expenseCats.filter((x) => x !== name));
  else setIncomeCats(incomeCats.filter((x) => x !== name));
  showToast("Đã xóa danh mục");
  }
  async function removeVendor(name) {
    const { error } = await supabase.from("vendors").delete().eq("name", name);
    if (error) { console.error(error); return; }
    setVendors(vendors.filter((x) => x !== name));
    showToast("Đã xóa NCC");
  }
  async function removeMember(name) {
    const { error } = await supabase.from("members").delete().eq("name", name);
    if (error) { console.error(error); return; }
    setMembers(members.filter((x) => x !== name));
    showToast("Đã xóa thành viên");
  }

async function renameMember(oldName) {
    const next = window.prompt("Sửa tên thành viên:", oldName);
    if (!next || !next.trim() || next.trim() === oldName) return;
    const name = next.trim();
    if (members.includes(name)) { alert("Tên này đã tồn tại."); return; }

    const { error } = await supabase.from("members").update({ name }).eq("name", oldName);
    if (error) { console.error(error); return; }
    await supabase.from("transactions").update({ member: name }).eq("member", oldName);
    await supabase.from("recurring_items").update({ member: name }).eq("member", oldName);

    setMembers(members.map((m) => (m === oldName ? name : m)));
    setTxs(txs.map((t) => (t.member === oldName ? { ...t, member: name } : t)));
    setRecurring(recurring.map((r) => (r.member === oldName ? { ...r, member: name } : r)));
    showToast("Đã cập nhật thành viên");
  }

  async function renameCategory(oldName, type) {
    const next = window.prompt("Sửa tên danh mục:", oldName);
    if (!next || !next.trim() || next.trim() === oldName) return;
    const name = next.trim();
    const list = type === "income" ? incomeCats : expenseCats;
    if (list.includes(name)) { alert("Tên này đã tồn tại."); return; }

    const { error } = await supabase.from("categories").update({ name }).eq("name", oldName).eq("type", type);
    if (error) { console.error(error); return; }
    await supabase.from("transactions").update({ category: name }).eq("category", oldName).eq("type", type);
    await supabase.from("recurring_items").update({ category: name }).eq("category", oldName);
    await supabase.from("budgets").update({ category: name }).eq("category", oldName);

    if (type === "income") setIncomeCats(incomeCats.map((c) => (c === oldName ? name : c)));
    else setExpenseCats(expenseCats.map((c) => (c === oldName ? name : c)));
    setTxs(txs.map((t) => (t.category === oldName && t.type === type ? { ...t, category: name } : t)));
    setRecurring(recurring.map((r) => (r.category === oldName ? { ...r, category: name } : r)));
    setBudgets(budgets.map((b) => (b.category === oldName ? { ...b, category: name } : b)));
    showToast("Đã cập nhật danh mục");
  }

  async function renameVendor(oldName) {
    const next = window.prompt("Sửa tên nhà cung cấp:", oldName);
    if (!next || !next.trim() || next.trim() === oldName) return;
    const name = next.trim();
    if (vendors.includes(name)) { alert("Tên này đã tồn tại."); return; }

    const { error } = await supabase.from("vendors").update({ name }).eq("name", oldName);
    if (error) { console.error(error); return; }
    await supabase.from("transactions").update({ vendor: name }).eq("vendor", oldName);

    setVendors(vendors.map((v) => (v === oldName ? name : v)));
    setTxs(txs.map((t) => (t.vendor === oldName ? { ...t, vendor: name } : t)));
    showToast("Đã cập nhật nhà cung cấp");
  }

async function addCategory() {
  if (!newCatName.trim()) return;
  const { error } = await supabase.from("categories").insert({ name: newCatName.trim(), type: newCatType });
  if (error) { console.error(error); return; }
  if (newCatType === "income") setIncomeCats([...incomeCats, newCatName.trim()]);
  else setExpenseCats([...expenseCats, newCatName.trim()]);
  setNewCatName("");
  showToast("Đã thêm danh mục");
}


async function addVendor() {
  if (!newVendorName.trim()) return;
  const { error } = await supabase.from("vendors").insert({ name: newVendorName.trim() });
  if (error) { console.error(error); return; }
  setVendors([...vendors, newVendorName.trim()]);
  setNewVendorName("");
  showToast("Đã thêm NCC");
}
async function addMember() {
  if (!newMemberName.trim()) return;
  const { error } = await supabase.from("members").insert({ name: newMemberName.trim() });
  if (error) { console.error(error); return; }
  setMembers([...members, newMemberName.trim()]);
  setNewMemberName("");
  showToast("Đã thêm thành viên");
}

  async function saveAccount() {
  if (!newAcc.name.trim()) return;
  const payload = accToDb({ ...newAcc, statementDay: Number(newAcc.statementDay), dueDay: Number(newAcc.dueDay), openingBalance: Number(newAcc.openingBalance) || 0, creditLimit: Number(newAcc.creditLimit) || 0 });
  if (editingAccId) {
    const { data, error } = await supabase.from("accounts").update(payload).eq("id", editingAccId).select().single();
    if (error) { console.error(error); return; }
    setAccounts(accounts.map((a) => a.id === editingAccId ? accFromDb(data) : a));
    setEditingAccId(null);
    showToast("Đã cập nhật tài khoản");
  } else {
    const { data, error } = await supabase.from("accounts").insert(payload).select().single();
    if (error) { console.error(error); return; }
    setAccounts([...accounts, accFromDb(data)]);
    showToast("Đã tạo tài khoản");
  }
  
setNewAcc({ name: "", type: "debit", statementDay: 15, dueDay: 5, dueMonthOffset: 1, includeNetWorth: true, openingBalance: "", creditLimit: "" });
}

function startEditAccount(a) {
  setEditingAccId(a.id);
  setNewAcc({
    name: a.name, type: a.type, statementDay: a.statementDay || 15, dueDay: a.dueDay || 5,
    dueMonthOffset: a.dueMonthOffset ?? 1,
    includeNetWorth: a.includeNetWorth, openingBalance: String(a.openingBalance || ""), creditLimit: String(a.creditLimit || ""),
  });
  setTab("caidat");
  setTimeout(() => document.getElementById("add-account-section")?.scrollIntoView({ behavior: "smooth" }), 100);
}

  async function removeAccount(id) {
  const acc = accounts.find((a) => a.id === id);
  if (!window.confirm('Xóa tài khoản "' + (acc?.name || "") + '"? Các giao dịch liên quan sẽ không bị xóa nhưng có thể hiển thị lỗi.')) return;
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) { console.error(error); return; }
  setAccounts(accounts.filter((a) => a.id !== id));
  showToast("Đã xóa tài khoản");
  }

  async function toggleNetWorth(id) {
  const acc = accounts.find((a) => a.id === id);
  const { error } = await supabase.from("accounts").update({ include_net_worth: !acc.includeNetWorth }).eq("id", id);
  if (error) { console.error(error); return; }
  setAccounts(accounts.map((a) => a.id === id ? { ...a, includeNetWorth: !a.includeNetWorth } : a));
  }

async function saveRecurring() {
if (!newRecurring.name.trim() || !newRecurring.amount) return;
const payload = recToDb({ ...newRecurring, amount: Number(newRecurring.amount), repeatValue: Number(newRecurring.repeatValue) || 1 });
if (editingRecurringId) {
  const { data, error } = await supabase.from("recurring_items").update(payload).eq("id", editingRecurringId).select().single();
  if (error) { console.error(error); return; }
  setRecurring(recurring.map((r) => r.id === editingRecurringId ? recFromDb(data) : r));
  showToast("Đã cập nhật khoản định kỳ");
} else {
  const { data, error } = await supabase.from("recurring_items").insert(payload).select().single();
  if (error) { console.error(error); return; }
  setRecurring([...recurring, recFromDb(data)]);
  showToast("Đã thêm khoản định kỳ");
}
setEditingRecurringId(null);
setNewRecurring({ name: "", amount: "", category: expenseCats[0] || "", member: members[0] || "", accountId: accounts[0]?.id || "", startDate: todayISO(), repeatValue: 1, repeatUnit: "month", cycleCount: "", principal: "", isInstallment: false });
}

function startEditRecurring(r) {
  setEditingRecurringId(r.id);
  setNewRecurring({
    name: r.name,
    amount: String(r.amount || ""),
    category: r.category,
    member: r.member || members[0] || "",
    accountId: r.accountId,
    startDate: r.startDate,
    repeatValue: r.repeatValue,
    repeatUnit: r.repeatUnit,
    cycleCount: r.cycleCount ? String(r.cycleCount) : "",
    principal: r.principal ? String(r.principal) : "",
    isInstallment: r.isInstallment,
  });
  setTab("caidat");
  setTimeout(() => document.getElementById("add-recurring-section")?.scrollIntoView({ behavior: "smooth" }), 100);
}

  async function removeRecurring(id) {
  if (!window.confirm("Xóa khoản định kỳ này?")) return;
  const { error } = await supabase.from("recurring_items").delete().eq("id", id);
  if (error) { console.error(error); return; }
  setRecurring(recurring.filter((r) => r.id !== id));
  showToast("Đã xóa khoản định kỳ");
  }

async function toggleRecurringActive(r) {
  const { error } = await supabase.from("recurring_items").update({ is_active: !r.isActive }).eq("id", r.id);
  if (error) { console.error(error); showToast("Không cập nhật được"); return; }
  setRecurring((prev) => prev.map((x) => x.id === r.id ? { ...x, isActive: !x.isActive } : x));
  showToast(r.isActive ? "Đã tạm dừng khoản định kỳ" : "Đã kích hoạt lại");
}

  async function logRecurring(r, dateOverride, occurrenceIndexOverride) {
  if (r.cycleCount > 0 && r.doneCount >= r.cycleCount) return false;
  const date = dateOverride || todayISO();
  const occurrenceIndex = occurrenceIndexOverride ?? r.doneCount;

  const { data, error } = await supabase.rpc("log_recurring_occurrence", {
    p_recurring_id: r.id,
    p_occurrence_index: occurrenceIndex,
    p_date: date,
    p_amount: r.amount,
    p_category: r.category,
    p_member: members[0] || null,
    p_account_id: r.accountId,
    p_note: r.name + " (định kỳ)",
  });

  if (error) {
    if (error.message?.includes("STALE_DONE_COUNT") || error.code === "23505") {
      // Kỳ này đã được ghi nhận từ lần chạy khác rồi — không phải lỗi thật
      return true;
    }
    console.error(error);
    return false;
  }

  setTxs((prev) => [txFromDb(data), ...prev]);
  setRecurring((prev) => prev.map((x) => x.id === r.id ? { ...x, doneCount: occurrenceIndex + 1 } : x));
  return true;
}

  async function saveBudget() {
    if (!newBudget.limit) return;
    const existing = budgets.find((b) => b.category === newBudget.category);
    if (existing) {
      const { error } = await supabase.from("budgets").update({ monthly_limit: Number(newBudget.limit) }).eq("id", existing.id);
      if (error) { console.error(error); return; }
      setBudgets(budgets.map((b) => b.category === newBudget.category ? { ...b, limit: Number(newBudget.limit) } : b));
      showToast("Đã cập nhật ngân sách");
    } else {
      const { data, error } = await supabase.from("budgets").insert({ category: newBudget.category, monthly_limit: Number(newBudget.limit) }).select().single();
      if (error) { console.error(error); return; }
      setBudgets([...budgets, { id: data.id, category: data.category, limit: data.monthly_limit }]);
      showToast("Đã tạo ngân sách");
    }
    setEditingBudgetCat(null);
    setNewBudget({ category: expenseCats[0] || "", limit: "" });
  }
  function startEditBudget(b) {
    setEditingBudgetCat(b.category);
    setNewBudget({ category: b.category, limit: String(b.limit) });
    setTab("caidat");
    setTimeout(() => document.getElementById("add-budget-section")?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function applyParetoBudgets() {
  const now = new Date();
  const lastMonthKey = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const recurringCats = new Set(recurring.map((r) => r.category)); // danh mục đang là chi phí cố định/định kỳ/trả góp

  const lastMonthByCat = {};
  txs.forEach((t) => {
    if (t.type !== "expense") return;
    if (t.recurringId) return;
    if (recurringCats.has(t.category)) return;
    if (monthKey(new Date(t.date + "T00:00:00")) !== lastMonthKey) return;
    lastMonthByCat[t.category] = (lastMonthByCat[t.category] || 0) + t.amount;
  });

  const entries = Object.entries(lastMonthByCat).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  let cum = 0;
  const paretoCats = [];
  for (const [cat, amt] of entries) {
    cum += amt;
    paretoCats.push({ cat, amt });
    if (total > 0 && cum / total >= 0.8) break;
  }

  const staleBudgets = budgets.filter((b) => recurringCats.has(b.category));

  if (paretoCats.length === 0 && staleBudgets.length === 0) {
    showToast("Chưa có dữ liệu chi tiêu tháng trước để tính");
    return;
  }

  const confirmMsg = staleBudgets.length > 0
    ? `Áp dụng hạn mức = 80% chi tiêu tháng trước cho ${paretoCats.length} danh mục chiếm ~80% tổng chi (Pareto), đồng thời xoá ${staleBudgets.length} ngân sách đang gán nhầm cho khoản chi phí cố định/định kỳ (${staleBudgets.map(b => b.category).join(", ")})? Hạn mức hiện có của các danh mục Pareto sẽ bị ghi đè.`
    : `Áp dụng hạn mức = 80% chi tiêu tháng trước cho ${paretoCats.length} danh mục chiếm ~80% tổng chi (Pareto)? Hạn mức hiện có của các danh mục này sẽ bị ghi đè.`;
  if (!window.confirm(confirmMsg)) return;

  for (const b of staleBudgets) {
    const { error } = await supabase.from("budgets").delete().eq("id", b.id);
    if (error) { console.error(error); continue; }
    setBudgets((prev) => prev.filter((x) => x.id !== b.id));
  }

  for (const { cat, amt } of paretoCats) {
    const newLimit = Math.floor((amt * 0.8) / 100000) * 100000;
    const existing = budgets.find((b) => b.category === cat);
    if (existing) {
      const { error } = await supabase.from("budgets").update({ monthly_limit: newLimit }).eq("id", existing.id);
      if (error) { console.error(error); continue; }
      setBudgets((prev) => prev.map((b) => b.category === cat ? { ...b, limit: newLimit } : b));
    } else {
      const { data, error } = await supabase.from("budgets").insert({ category: cat, monthly_limit: newLimit }).select().single();
      if (error) { console.error(error); continue; }
      setBudgets((prev) => [...prev, { id: data.id, category: data.category, limit: data.monthly_limit }]);
    }
  }
  showToast("Đã áp dụng hạn mức tự động theo Pareto 80/20");
}

  async function removeBudget(cat) {
  if (!window.confirm('Xóa ngân sách "' + cat + '"?')) return;
  const b = budgets.find((x) => x.category === cat);
  if (!b) return;
  const { error } = await supabase.from("budgets").delete().eq("id", b.id);
  if (error) { console.error(error); return; }
  setBudgets(budgets.filter((x) => x.category !== cat));
  showToast("Đã xóa ngân sách");
  }

  const upcomingByUnit = useMemo(() => {
    const g = { week: 0, month: 0, year: 0 };
    recurring.forEach((r) => {
      if (r.isActive === false) return;                                  // ← thêm
      const done = r.cycleCount > 0 && r.doneCount >= r.cycleCount;
      if (!done && g[r.repeatUnit] !== undefined) g[r.repeatUnit] += r.amount;
    });
    return g;
  }, [recurring]);

  const pendingRecurring = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return recurring.filter((r) => {
      if (r.isActive === false) return false;                            // ← thêm
      const done = r.cycleCount > 0 && r.doneCount >= r.cycleCount;
      const acc = accById(r.accountId);
      return !done && nextDueDate(r, acc) <= now;
    });
  }, [recurring, accounts]);

  const installmentReserved = useMemo(() => {
    const g = {};
    recurring.forEach((r) => {
      if (!r.isInstallment || !r.principal) return;
      const paid = r.doneCount * r.amount;
      const remaining = Math.max(0, r.principal - paid);
      g[r.accountId] = (g[r.accountId] || 0) + remaining;
    });
    return g;
  }, [recurring]);

  const balances = useMemo(() => {
    const bal = {};
    accounts.forEach((a) => (bal[a.id] = a.type === "payable" ? -(a.openingBalance || 0) : (a.openingBalance || 0))); // payable: số dư đầu kỳ là khoản phải trả nên tính âm
    txs.forEach((t) => {
      if (t.type === "income") bal[t.accountId] = (bal[t.accountId] || 0) + t.amount;
      if (t.type === "expense") bal[t.accountId] = (bal[t.accountId] || 0) - t.amount;
      if (t.type === "transfer") {
        bal[t.accountId] = (bal[t.accountId] || 0) - t.amount;
        bal[t.toAccountId] = (bal[t.toAccountId] || 0) + t.amount;
      }
    });
    return bal;
  }, [txs, accounts]);

const reconcile = useMemo(() => {
    const creditAccounts = accounts.filter((a) => a.type === "credit");
    const acc = accounts.find((a) => a.id === reconcileAccId) || creditAccounts[0];
    if (!acc) return null;

    const cutoff = lastStatementCutoff(acc);
    const cutoffStr = toISODate(cutoff);
    const dueDate = dueDateForCutoff(cutoff, acc);
    const dueStr = toISODate(dueDate);
    const prevCutoff = new Date(cutoff.getFullYear(), cutoff.getMonth() - 1, acc.statementDay);
    const prevCutoffStr = toISODate(prevCutoff);
    const todayStr = todayISO();

    const balanceAsOf = (dateStr) => {
      let bal = acc.openingBalance || 0;
      txs.forEach((t) => {
        if (t.date >= dateStr) return;
        if (t.accountId === acc.id) {
          if (t.type === "income") bal += t.amount;
          if (t.type === "expense") bal -= t.amount;
          if (t.type === "transfer") bal -= t.amount;
        }
        if (t.toAccountId === acc.id && t.type === "transfer") bal += t.amount;
      });
      return bal;
    };

    const txsInRange = (fromInclusiveStr, toExclusiveStr) => txs.filter((t) => {
      if (!(t.date >= fromInclusiveStr && t.date < toExclusiveStr)) return false;
      return t.accountId === acc.id || (t.toAccountId === acc.id && t.type === "transfer");
    });

        const toItem = (t) => {
      const isPayment = (t.accountId === acc.id && t.type === "income") || (t.toAccountId === acc.id && t.type === "transfer");
      return { label: `${fmtDate(t.date)} · ${t.note || t.vendor || t.category || "—"}`, amount: t.amount, sign: isPayment ? "-" : "+", tx: t };
    };

    const toItemsGrouped = (list) => {
      const seen = new Map();
      const result = [];
      list.forEach((t) => {
        if (!t.splitGroupId) { result.push(toItem(t)); return; }
        if (seen.has(t.splitGroupId)) {
          const g = seen.get(t.splitGroupId);
          g.amount += t.amount;
          g.children.push(toItem(t));
        } else {
          const isPayment = (t.accountId === acc.id && t.type === "income") || (t.toAccountId === acc.id && t.type === "transfer");
          const g = {
            label: `${fmtDate(t.date)} · ${t.vendor || t.note || "Hóa đơn gộp"}`,
            amount: t.amount,
            sign: isPayment ? "-" : "+",
            isGroup: true,
            children: [toItem(t)],
          };
          seen.set(t.splitGroupId, g);
          result.push(g);
        }
      });
      return result;
    };

    const closingBalance = Math.max(0, -balanceAsOf(cutoffStr));
    
    const cycleTxs = txsInRange(prevCutoffStr, cutoffStr);

    const paymentsAfterClosingTxs = txsInRange(cutoffStr, toISODate(new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate() + 1))).filter((t) =>
    (t.accountId === acc.id && t.type === "income") || (t.toAccountId === acc.id && t.type === "transfer")
    );
    const paymentsAfterClosing = paymentsAfterClosingTxs.reduce((s, t) => s + t.amount, 0);
    const tbgdRemaining = Math.max(0, closingBalance - paymentsAfterClosing);

    const currentBalance = Math.max(0, -(balances[acc.id] || 0));
    const currentTxs = txsInRange(prevCutoffStr, toISODate(new Date(new Date(todayStr).getFullYear(), new Date(todayStr).getMonth(), new Date(todayStr).getDate() + 1)));

    const installmentBalance = installmentReserved[acc.id] || 0;
    const installmentItems = recurring
      .filter((r) => r.isInstallment && r.accountId === acc.id && r.principal)
      .map((r) => {
        const paid = r.doneCount * r.amount;
        const remaining = Math.max(0, r.principal - paid);
        const left = Math.max(0, (r.cycleCount || 0) - r.doneCount);
        return { label: `${r.name} (còn ${left} kỳ)`, amount: remaining, sign: "+" };
      })
      .filter((it) => it.amount > 0);

    const available = (acc.creditLimit || 0) - currentBalance - installmentBalance;

        return {
      acc, cutoff, dueDate,
      closingBalance, cycleItems: toItemsGrouped(cycleTxs),
      tbgdRemaining, tbgdItems: toItemsGrouped([...cycleTxs, ...paymentsAfterClosingTxs]),
      currentBalance, currentItems: toItemsGrouped(currentTxs),
      installmentBalance, installmentItems,
      available,
      duePayment: closingBalance,
    };
  }, [reconcileAccId, accounts, txs, balances, installmentReserved, recurring]);

  const netWorth = useMemo(() => accounts.filter((a) => a.includeNetWorth).reduce((s, a) => s + (balances[a.id] || 0), 0), [accounts, balances]);
  const liabilities = useMemo(() => accounts.filter((a) => a.type === "credit" || a.type === "payable").reduce((s, a) => s + Math.max(0, -(balances[a.id] || 0)), 0), [accounts, balances]);

  function effDate(t) {
    if (t.type !== "expense") return new Date(t.date + "T00:00:00");
    if (dateBasis === "phatsinh") return new Date(t.date + "T00:00:00");
    return getCashFlowDate(t, accById(t.accountId));
  }

  const filteredTxs = useMemo(() => {
    return txs.filter((t) => {
      const d = effDate(t);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return key >= reportFrom && key <= reportTo;
    });
  }, [txs, reportFrom, reportTo, dateBasis, accounts]);

  const monthlyTotals = useMemo(() => {
    const groups = {};
    filteredTxs.forEach((t) => {
      if (t.type === "transfer") return;
      const key = monthKey(effDate(t));
      groups[key] = groups[key] || { income: 0, expense: 0 };
      groups[key][t.type] += t.amount;
    });
    return Object.entries(groups).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filteredTxs, dateBasis]);

  const byAccount = useMemo(() => {
  const g = {};
    filteredTxs.forEach((t) => {
      if (t.type === "transfer") {
        g[t.accountId] = g[t.accountId] || { income: 0, expense: 0 };
        g[t.accountId].expense += t.amount;
        g[t.toAccountId] = g[t.toAccountId] || { income: 0, expense: 0 };
        g[t.toAccountId].income += t.amount;
      } else {
        g[t.accountId] = g[t.accountId] || { income: 0, expense: 0 };
        g[t.accountId][t.type] += t.amount;
      }
    });
    return g;
  }, [filteredTxs]);

  const byMember = useMemo(() => {
    const g = {};
    filteredTxs.filter((t) => t.type !== "transfer").forEach((t) => {
      const key = t.member || "Chưa gán thành viên";
      g[key] = g[key] || { income: 0, expense: 0 };
      g[key][t.type] += t.amount;
    });
    return g;
  }, [filteredTxs]);

  const byCategory = useMemo(() => {
    const exp = {}, inc = {};
    filteredTxs.forEach((t) => {
      if (t.type === "expense") exp[t.category] = (exp[t.category] || 0) + t.amount;
      if (t.type === "income") inc[t.category] = (inc[t.category] || 0) + t.amount;
    });
    return { exp, inc };
  }, [filteredTxs]);

  const byVendor = useMemo(() => {
    const g = {};
    filteredTxs.filter((t) => t.type === "expense" && t.vendor).forEach((t) => {
      g[t.vendor] = (g[t.vendor] || 0) + t.amount;
    });
    return g;
  }, [filteredTxs]);

  const pieExpense = useMemo(() => Object.entries(byCategory.exp).map(([name, value]) => ({ name, value })), [byCategory]);
  const pieIncome = useMemo(() => Object.entries(byCategory.inc).map(([name, value]) => ({ name, value })), [byCategory]);

  const currentMonthExpenseByCat = useMemo(() => {
  const key = monthKey(new Date(todayISO() + "T00:00:00"));
  const g = {};
    txs.filter((t) => t.type === "expense" && monthKey(new Date(t.date + "T00:00:00")) === key).forEach((t) => {
      g[t.category] = (g[t.category] || 0) + t.amount;
    });
    return g;
  }, [txs]);

  const lastMonthExpenseByCat = useMemo(() => {
    const now = new Date(todayISO() + "T00:00:00");
    const key = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const g = {};
    txs.filter((t) => t.type === "expense" && monthKey(new Date(t.date + "T00:00:00")) === key).forEach((t) => {
      g[t.category] = (g[t.category] || 0) + t.amount;
    });
    return g;
  }, [txs]);

  const periodTxs = useMemo(() => txs.filter((t) => t.type !== "transfer" && inPeriod(t.date, txPeriod)), [txs, txPeriod]);
  const periodIncome = periodTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const periodExpense = periodTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const recentList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
      return txs.filter((t) => {
        if (!inPeriod(t.date, txPeriod)) return false;
        if (!q) return true;
        const qDigits = q.replace(/[^\d]/g, "");
        const amountStr = String(t.amount || "");
        const matchAmount = qDigits && amountStr.includes(qDigits);
        const matchText = [t.note, t.category, t.vendor, t.member].some((f) => (f || "").toLowerCase().includes(q));
        return matchText || matchAmount;
      });
    }, [txs, txPeriod, searchQuery]);

    const recentListByDate = useMemo(() => {
    const groups = [];
    const map = {};
    recentList.forEach((t) => {
      if (!map[t.date]) {
        map[t.date] = { date: t.date, txs: [], income: 0, expense: 0 };
        groups.push(map[t.date]);
      }
      map[t.date].txs.push(t);
      if (t.type === "income") map[t.date].income += t.amount;
      if (t.type === "expense") map[t.date].expense += t.amount;
    });

    groups.forEach((day) => {
      const seen = new Map();
      const merged = [];
      day.txs.forEach((t) => {
        if (!t.splitGroupId) { merged.push(t); return; }
        if (seen.has(t.splitGroupId)) {
          seen.get(t.splitGroupId).items.push(t);
        } else {
          const acc = accById(t.accountId);
          const g = { isGroup: true, id: t.splitGroupId, accountId: t.accountId, accName: acc?.name, accType: acc?.type, vendor: t.vendor, note: t.note, items: [t] };
          seen.set(t.splitGroupId, g);
          merged.push(g);
        }
      });
      day.txs = merged;
    });

    return groups;
  }, [recentList, accounts]);

  const inputStyle = `
  * { box-sizing: border-box; }
  html, body { overflow-x: clip; max-width: 100vw; }
  html { font-size: 18.4px; }
  input, select {
    background: ${COLORS.surface2}; border: 1px solid ${COLORS.border}; color: ${COLORS.textPrimary};
    border-radius: 6px; padding: 10px 12px; font-size: 16px; width: 100%; line-height: 1.3;
  }

  .chip-row { -ms-overflow-style: none; scrollbar-width: none; }
  .chip-row::-webkit-scrollbar { display: none; }

  select {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23657059' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    padding-right: 32px;
  }
  select option {
    background: ${COLORS.surface2};
    color: ${COLORS.textPrimary};
  }

  input[type="date"] {
    width: 100%;
    box-sizing: border-box;
    border: none;
    background: transparent;
    padding: 10px 8px;
  }

  input[type="number"] {
    -moz-appearance: textfield;
  }
  input[type="number"]::-webkit-outer-spin-button,
  input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .date-wrap {
    background: ${COLORS.surface2};
    border: 1px solid ${COLORS.border};
    border-radius: 6px;
    overflow: hidden;
    width: 100%;
  }
  input::placeholder { color: ${COLORS.textMuted}; }
  input:focus, select:focus { outline: none; border-color: ${COLORS.cream}; }
  .mono { font-family: 'JetBrains Mono', monospace; }
  .sans { font-family: system-ui, -apple-system, sans-serif; }
  .ledger-line { border-bottom: 1px dashed ${COLORS.border}; }
  .lbl { font-size: 12px; color: ${COLORS.textSecondary}; display:block; margin-bottom: 4px; }
`;

  const unitLabel = (u) => REPEAT_UNITS.find((x) => x.v === u)?.l || u;

    if (checkingAuth) {
      return <div style={{ minHeight: "100vh", background: "#1B211A" }} />;
    }
    if (!session) {
      return <Login />;
    }
    if (loadingData) {
      return (
        <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p className="sans" style={{ color: COLORS.textMuted, fontSize: 13 }}>Đang tải dữ liệu...</p>
        </div>
      );
    }

  return (
    <div style={{ fontFamily: "'Newsreader', Georgia, serif", background: COLORS.bg, color: COLORS.textPrimary }} className="min-h-screen pb-24">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Newsreader:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');${inputStyle}`}</style>

      <div className="px-5 pt-8 pb-4 border-b flex items-center gap-2" style={{ borderColor: COLORS.border }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: COLORS.cream }}>
          <Wallet size={16} color={COLORS.bg} />
        </div>
        <h1 className="text-xl" style={{ fontWeight: 600 }}>Sổ Dòng Tiền</h1>
        <button onClick={() => supabase.auth.signOut()} className="sans text-xs" style={{ color: COLORS.textMuted }}>
          Đăng xuất
        </button>
      </div>

      {/* NHAP */}
      {tab === "nhap" && (
      <div className="px-5 pt-5 space-y-5">
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: COLORS.bg, paddingTop: 8, paddingBottom: 8, marginBottom: 4 }}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex gap-2" style={{ overflowX: "auto" }}>
              {[{ v: "today", l: "Hôm nay" }, { v: "week", l: "Tuần này" }, { v: "month", l: "Tháng này" }, { v: "all", l: "Tất cả" }].map((o) => (
                <Chip key={o.v} label={o.l} active={txPeriod === o.v} onClick={() => setTxPeriod(o.v)} />
              ))}
            </div>
            <button onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(""); }} style={{ color: searchOpen ? COLORS.cream : COLORS.textMuted, flexShrink: 0 }}>
              <Search size={18} />
            </button>
          </div>
          {searchOpen && (
            <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Tìm theo ghi chú, danh mục, NCC, thành viên..." className="mb-3" />
          )}
          <div className="flex gap-3">
            <MetricCard label="Tổng thu" value={periodIncome} color={COLORS.accent} />
            <MetricCard label="Tổng chi" value={periodExpense} color={COLORS.expense} />
          </div>
        </div>

        <div className="space-y-3">
  {recentListByDate.map((day) => (
    <div key={day.date} className="rounded-lg" style={{ background: COLORS.surface2, border: "1px solid " + COLORS.border, overflow: "hidden" }}>
      <div className="flex items-center justify-between sans" style={{ padding: "6px 12px", background: COLORS.surface, fontSize: 11, color: COLORS.textMuted }}>
        <span>{fmtDateWithWeekday(day.date)}</span>
        <span className="mono flex items-center gap-2">
          <span style={{ color: COLORS.accent }}>+{fmtVND(day.income)}</span>
          <span style={{ color: COLORS.expense }}>-{fmtVND(day.expense)}</span>
        </span>
        </div>
            <div style={{ padding: "0 12px" }}>
                {day.txs.map((t) => {
                if (t.isGroup) return <SplitGroupRow key={t.id} group={t} onEditTx={setDetailTx} onEditGroup={startEditSplitGroup} />;
                  const acc = accById(t.accountId);
                  const color = t.type === "income" ? COLORS.accent : t.type === "transfer" ? COLORS.transfer : COLORS.expense;
                  const sign = t.type === "income" ? "+" : t.type === "transfer" ? "" : "-";
                  return (
                    <div key={t.id} className="ledger-line py-3 flex items-center justify-between" style={{ gap: 12, cursor: "pointer" }} onClick={() => setDetailTx(t)}>
                      <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: COLORS.textMuted, flexShrink: 0 }}><AccIcon type={acc?.type} /></div>
                        <div style={{ minWidth: 0 }}>
                          <p className="sans text-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.note || t.category || (t.type === "transfer" ? "Chuyển khoản" : "")}
                          </p>
                          <p className="sans text-xs" style={{ color: COLORS.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.type === "transfer" ? `${acc?.name} → ${accById(t.toAccountId)?.name}` : `${t.category}${t.vendor ? " · " + t.vendor : ""}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
                        <span className="mono text-sm" style={{ color }}>{sign}{fmtVND(t.amount)}</span>
                        <span className="sans text-xs" style={{ color: COLORS.textMuted }}>{acc?.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {recentList.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có giao dịch trong khoảng này.</p>}
        </div>
      </div>
    )}

      {/* BAO CAO */}
      {tab === "baocao" && (
        <div className="px-5 pt-5 space-y-5">
          <div className="flex gap-2">
            <div className="flex-1"><label className="lbl">Từ ngày</label><input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} /></div>
            <div className="flex-1"><label className="lbl">Đến ngày</label><input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} /></div>
          </div>

        <div className="flex gap-2">
          {[{ v: "phatsinh", l: "Theo ngày ghi nhận" }, { v: "dongtien", l: "Theo dòng tiền" }].map((o) => (
            <button key={o.v} onClick={() => setDateBasis(o.v)} className="sans flex-1 py-2.5 rounded-md text-xs"
              style={{ border: "1px solid " + (dateBasis === o.v ? COLORS.cream : COLORS.border), color: dateBasis === o.v ? COLORS.cream : COLORS.textSecondary, fontWeight: 600 }}>
              {o.l}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { v: "danhmuc", l: "Theo danh mục" },
            { v: "ncc", l: "Theo NCC" },
            { v: "tytrong", l: "Tỷ trọng" },
            { v: "taikhoan", l: "Theo tài khoản" },
            { v: "thanhvien", l: "Theo thành viên" },
            { v: "tonghop", l: "Tổng hợp tháng" },
            { v: "doichieu", l: "Đối chiếu sao kê" },
          ].map((o) => <Chip key={o.v} label={o.l} active={reportView === o.v} onClick={() => setReportView(o.v)} />)}
        </div>
        
          {reportView === "danhmuc" && (
            <div className="space-y-6">
              <div>
                <p className="sans text-xs mb-2" style={{ color: COLORS.textSecondary }}>Chi tiêu theo danh mục (bấm để xem chi tiết)</p>
                {Object.entries(byCategory.exp).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                  const max = Math.max(...Object.values(byCategory.exp));
                  const txList = filteredTxs.filter((t) => t.type === "expense" && t.category === cat);
                  return <CategoryRow key={cat} label={cat} amount={amt} max={max} color={COLORS.expense} txList={txList} onEditTx={setDetailTx} />;
                })}
                {pieExpense.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có dữ liệu trong khoảng ngày đã chọn.</p>}
              </div>
              <div>
                <p className="sans text-xs mb-2" style={{ color: COLORS.textSecondary }}>Thu nhập theo danh mục (bấm để xem chi tiết)</p>
                {Object.entries(byCategory.inc).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                  const max = Math.max(...Object.values(byCategory.inc));
                  const txList = filteredTxs.filter((t) => t.type === "income" && t.category === cat);
                 return <CategoryRow key={cat} label={cat} amount={amt} max={max} color={COLORS.expense} txList={txList} onEditTx={setDetailTx} />;
                })}
              </div>
            </div>
          )}

          {reportView === "tytrong" && (
            <div className="space-y-8">
              <div>
                <p className="sans text-xs mb-1" style={{ color: COLORS.textSecondary }}>Tỷ trọng chi tiêu</p>
                {pieExpense.length > 0 ? (
                  <div style={{ height: 260, position: "relative" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieExpense}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={({ name }) => (selectedExpenseCat === name ? 86 : 80)}
                          paddingAngle={2}
                          onClick={(d) => setSelectedExpenseCat((prev) => (prev === d.name ? null : d.name))}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, index }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            const dim = selectedExpenseCat && selectedExpenseCat !== name;
                            return (
                              <text x={x} y={y} fill={dim ? COLORS.textMuted : PIE_COLORS[index % PIE_COLORS.length]} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12}>
                                {`${(percent * 100).toFixed(0)}%`}
                              </text>
                            );
                          }}
                          labelLine={false}
                        >
                          {pieExpense.map((d, i) => (
                            <Cell
                              key={d.name}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                              opacity={selectedExpenseCat && selectedExpenseCat !== d.name ? 0.3 : 1}
                              style={{ cursor: "pointer" }}
                            />
                          ))}
                        </Pie>
                        <Legend
                          onClick={(e) => setSelectedExpenseCat((prev) => (prev === e.value ? null : e.value))}
                          payload={pieExpense.map((d, i) => ({
                            value: d.name,
                            type: "square",
                            color: PIE_COLORS[i % PIE_COLORS.length],
                            id: d.name,
                          }))}
                          formatter={(value) => (
                            <span style={{ color: selectedExpenseCat === value ? COLORS.cream : COLORS.textSecondary, fontWeight: selectedExpenseCat === value ? 700 : 400 }}>
                              {value}
                            </span>
                          )}
                          wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {selectedExpenseCat && (() => {
                      const d = pieExpense.find((x) => x.name === selectedExpenseCat);
                      const total = pieExpense.reduce((s, x) => s + x.value, 0);
                      if (!d) return null;
                      return (
                        <div style={{
                          position: "absolute", top: 8, right: 4, width: 150,
                          background: COLORS.surface, border: "1px solid " + COLORS.border, borderRadius: 10,
                          padding: "8px 10px", boxShadow: "0 4px 14px rgba(0,0,0,0.4)", textAlign: "right", zIndex: 5,
                        }}>
                          <p className="sans text-xs" style={{ color: COLORS.textSecondary, wordBreak: "break-word", lineHeight: 1.3 }}>{d.name}</p>
                          <p className="mono text-sm" style={{ color: COLORS.cream, fontWeight: 700, whiteSpace: "nowrap" }}>{fmtVND(d.value)}</p>
                          <p className="sans text-xs" style={{ color: COLORS.textMuted, whiteSpace: "nowrap" }}>{((d.value / total) * 100).toFixed(1)}%</p>
                        </div>
                      );
                    })()}
                  </div>
                ) : <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có dữ liệu.</p>}
              </div>

              <div>
                <p className="sans text-xs mb-1" style={{ color: COLORS.textSecondary }}>Tỷ trọng thu nhập</p>
                {pieIncome.length > 0 ? (
                  <div style={{ height: 260, position: "relative" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieIncome}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={({ name }) => (selectedIncomeCat === name ? 86 : 80)}
                          paddingAngle={2}
                          onClick={(d) => setSelectedIncomeCat((prev) => (prev === d.name ? null : d.name))}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, index }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = innerRadius + (outerRadius - innerRadius) * 1.3;
                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                            const dim = selectedIncomeCat && selectedIncomeCat !== name;
                            return (
                              <text x={x} y={y} fill={dim ? COLORS.textMuted : PIE_COLORS[index % PIE_COLORS.length]} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12}>
                                {`${(percent * 100).toFixed(0)}%`}
                              </text>
                            );
                          }}
                          labelLine={false}
                        >
                          {pieIncome.map((d, i) => (
                            <Cell
                              key={d.name}
                              fill={PIE_COLORS[i % PIE_COLORS.length]}
                              opacity={selectedIncomeCat && selectedIncomeCat !== d.name ? 0.3 : 1}
                              style={{ cursor: "pointer" }}
                            />
                          ))}
                        </Pie>
                       <Legend
                          onClick={(e) => setSelectedIncomeCat((prev) => (prev === e.value ? null : e.value))}
                          payload={pieIncome.map((d, i) => ({
                            value: d.name,
                            type: "square",
                            color: PIE_COLORS[i % PIE_COLORS.length],
                            id: d.name,
                          }))}
                          formatter={(value) => (
                            <span style={{ color: selectedIncomeCat === value ? COLORS.cream : COLORS.textSecondary, fontWeight: selectedIncomeCat === value ? 700 : 400 }}>
                              {value}
                            </span>
                          )}
                          wrapperStyle={{ fontSize: 11, cursor: "pointer" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {selectedIncomeCat && (() => {
                      const d = pieIncome.find((x) => x.name === selectedIncomeCat);
                      const total = pieIncome.reduce((s, x) => s + x.value, 0);
                      if (!d) return null;
                      return (
                        <div style={{
                          position: "absolute", top: 8, right: 4, width: 150,
                          background: COLORS.surface, border: "1px solid " + COLORS.border, borderRadius: 10,
                          padding: "8px 10px", boxShadow: "0 4px 14px rgba(0,0,0,0.4)", textAlign: "right", zIndex: 5,
                        }}>
                          <p className="sans text-xs" style={{ color: COLORS.textSecondary, wordBreak: "break-word", lineHeight: 1.3 }}>{d.name}</p>
                          <p className="mono text-sm" style={{ color: COLORS.cream, fontWeight: 700, whiteSpace: "nowrap" }}>{fmtVND(d.value)}</p>
                          <p className="sans text-xs" style={{ color: COLORS.textMuted, whiteSpace: "nowrap" }}>{((d.value / total) * 100).toFixed(1)}%</p>
                        </div>
                      );
                    })()}
                  </div>
                ) : <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có dữ liệu.</p>}
              </div>
            </div>
          )}

          {reportView === "taikhoan" && (
            <div className="space-y-2">
                {accounts.map((a) => {
                const d = byAccount[a.id] || { income: 0, expense: 0 };
                const txList = groupSplitTxs(filteredTxs.filter((t) => t.accountId === a.id || t.toAccountId === a.id));
                return <AccountReportCard key={a.id} account={a} data={d} balance={balances[a.id] || 0} txList={txList} onEditTx={setDetailTx} onEditGroup={startEditSplitGroup} />;
              })}
            </div>
          )}

          {reportView === "thanhvien" && (
            <div className="space-y-2">
              {Object.entries(byMember).map(([m, d]) => {
                const txList = filteredTxs.filter((t) => t.type !== "transfer" && (t.member || "Chưa gán thành viên") === m);
                return <MemberReportCard key={m} member={m} data={d} txList={txList} onEditTx={setDetailTx} />;
              })}
            </div>
          )}

          {reportView === "ncc" && (
            <div>
              <p className="sans text-xs mb-2" style={{ color: COLORS.textSecondary }}>Chi tiêu theo NCC (bấm để xem chi tiết)</p>
              {Object.entries(byVendor).sort((a, b) => b[1] - a[1]).map(([ven, amt]) => {
                const max = Math.max(...Object.values(byVendor));
                const txList = filteredTxs.filter((t) => t.type === "expense" && t.vendor === ven);
                return <CategoryRow key={ven} label={ven} amount={amt} max={max} color={COLORS.expense} txList={txList} onEditTx={setDetailTx} />;
              })}
              {Object.keys(byVendor).length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có dữ liệu NCC trong khoảng ngày đã chọn.</p>}
            </div>
          )}

          {reportView === "tonghop" && (
            <div className="space-y-4">
              {monthlyTotals.map(([key, d]) => {
                const txList = filteredTxs.filter((t) => t.type !== "transfer" && monthKey(effDate(t)) === key);
                return <MonthReportCard key={key} monthKeyStr={key} data={d} txList={txList} onEditTx={setDetailTx} />;
              })}
            </div>
          )}

          {reportView === "doichieu" && (
            <div className="space-y-4">
              {accounts.filter((a) => a.type === "credit").length === 0 ? (
                <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Chưa có thẻ tín dụng nào — thêm trong Cài đặt.</p>
              ) : (
                <>
                  <div>
                    <label className="lbl">Thẻ tín dụng</label>
                    <select
                      value={reconcileAccId || accounts.find((a) => a.type === "credit")?.id || ""}
                      onChange={(e) => setReconcileAccId(e.target.value)}
                    >
                      {accounts.filter((a) => a.type === "credit").map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  {reconcile && (
                    <div className="space-y-2">
                      <p className="sans text-xs" style={{ color: COLORS.textMuted }}>
                        Kỳ sao kê chốt ngày {pad(reconcile.cutoff.getDate())}/{pad(reconcile.cutoff.getMonth() + 1)}/{reconcile.cutoff.getFullYear()}
                        {" · "}Hạn thanh toán {pad(reconcile.dueDate.getDate())}/{pad(reconcile.dueDate.getMonth() + 1)}/{reconcile.dueDate.getFullYear()}
                      </p>

                      <ReconcileRow label="Dư nợ cuối kỳ" value={reconcile.closingBalance} items={reconcile.cycleItems} onSelectTx={setDetailTx} />
                      <ReconcileRow label="Dư nợ TBGD còn lại" value={reconcile.tbgdRemaining} items={reconcile.tbgdItems} onSelectTx={setDetailTx} />
                      <ReconcileRow label="Dư nợ hiện tại" value={reconcile.currentBalance} items={reconcile.currentItems} onSelectTx={setDetailTx} />
                      <ReconcileRow label="Dư nợ trả góp" value={reconcile.installmentBalance} items={reconcile.installmentItems} onSelectTx={setDetailTx} />
                      <ReconcileRow label="Số dư khả dụng" value={reconcile.available} items={null} />
                      <ReconcileRow
                        label={`Số phải thanh toán kỳ này (trước ${pad(reconcile.dueDate.getDate())}/${pad(reconcile.dueDate.getMonth() + 1)})`}
                        value={reconcile.duePayment}
                        items={reconcile.cycleItems}
                        onSelectTx={setDetailTx}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* NGAN SACH */}
      {tab === "ngansach" && (
        <div className="px-5 pt-5 space-y-7">
          <Section
            title={`Ngân sách theo danh mục (Tháng ${pad(new Date().getMonth() + 1)}/${new Date().getFullYear()})`}
            right={
              <button
                onClick={applyParetoBudgets}
                className="sans text-xs px-2 py-1 rounded"
                style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}
              >
                Tự động theo tháng trước (80/20)
              </button>
            }
          >
            <BudgetPaceView
              budgets={budgets}
              currentMonthExpenseByCat={currentMonthExpenseByCat}
              lastMonthExpenseByCat={lastMonthExpenseByCat}
              txs={txs}
              onEdit={startEditBudget}
              onRemove={removeBudget}
            />
          </Section>
           </div>
      )}

      {tab === "dinhky" && (
        <div className="px-5 pt-5 space-y-7">
          <Section
            title="Chi phí định kỳ"
            right={upcomingByUnit.month > 0 && (
              <span className="sans" style={{ fontSize: 14, color: COLORS.textSecondary }}>
                Tháng tới: <span className="mono" style={{ color: COLORS.accent, fontSize: 16, fontWeight: 700 }}>{fmtVND(upcomingByUnit.month)}</span>
              </span>
            )}
          >
            {pendingRecurring.length > 0 && (
              <div className="rounded-lg p-3 mb-3" style={{ background: "#332A1C", border: "1px solid " + COLORS.expense }}>
                <p className="sans text-xs" style={{ color: COLORS.expense, fontWeight: 600 }}>
                  {pendingRecurring.length} khoản đến hạn chưa ghi nhận
                </p>
              </div>
            )}
            <div className="sans text-xs mb-3 space-y-1" style={{ color: COLORS.textSecondary }}>
              {upcomingByUnit.week > 0 && <p>Tuần tiếp theo: <span className="mono" style={{ color: COLORS.cream }}>{fmtVND(upcomingByUnit.week)}</span></p>}
              {upcomingByUnit.year > 0 && <p>Năm tiếp theo: <span className="mono" style={{ color: COLORS.cream }}>{fmtVND(upcomingByUnit.year)}</span></p>}
            </div>
            <div className="space-y-4">
              {(() => {
                const installmentItems = recurring.filter((r) => r.isInstallment);
                const fixedItems = recurring.filter((r) => !r.isInstallment);
                const renderCard = (r) => {
                  const done = r.cycleCount > 0 && r.doneCount >= r.cycleCount;
                  const acc = accById(r.accountId);
                  const pending = !done && nextDueDate(r, acc) <= new Date();
                  const txList = txs.filter((t) => t.recurringId === r.id).sort((a, b) => (a.date < b.date ? 1 : -1));
                  return (
                    <RecurringItemCard
                      key={r.id}
                      r={r} acc={acc} done={done} pending={pending} txList={txList}
                      unitLabel={unitLabel}
                      onEdit={startEditRecurring} onRemove={removeRecurring}
                      onToggleActive={toggleRecurringActive}
                      onLog={(r) => logRecurring(r)}
                      onEditTx={(t) => { setTab("nhap"); startEditTx(t); }}
                    />
                  );
                };
                const monthTotal = (items) => items.reduce((sum, r) => {
                  const done = r.cycleCount > 0 && r.doneCount >= r.cycleCount;
                  return (!done && r.repeatUnit === "month") ? sum + r.amount : sum;
                }, 0);
                const installmentMonthTotal = monthTotal(installmentItems);
                const fixedMonthTotal = monthTotal(fixedItems);
                return (
                  <>
                    {installmentItems.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="sans text-xs" style={{ color: COLORS.cream, letterSpacing: 1, textTransform: "uppercase" }}>Trả góp</p>
                          {installmentMonthTotal > 0 && <span className="mono text-xs" style={{ color: COLORS.cream }}>{fmtVND(installmentMonthTotal)}</span>}
                        </div>
                        <div className="space-y-2">{installmentItems.map(renderCard)}</div>
                      </div>
                    )}
                    {fixedItems.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="sans text-xs" style={{ color: COLORS.textSecondary, letterSpacing: 1, textTransform: "uppercase" }}>Chi phí cố định</p>
                          {fixedMonthTotal > 0 && <span className="mono text-xs" style={{ color: COLORS.textSecondary }}>{fmtVND(fixedMonthTotal)}</span>}
                        </div>
                        <div className="space-y-2">{fixedItems.map(renderCard)}</div>
                      </div>
                    )}
                    {recurring.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Chưa có khoản định kỳ — thêm trong Cài đặt.</p>}
                  </>
                );
              })()}
            </div>
          </Section>
        </div>
      )}

      {/* TAI KHOAN */}
      {tab === "taikhoan" && (
        <div className="px-5 pt-5 space-y-5">
          <div className="flex gap-3">
            <MetricCard label="Tổng tài sản" value={netWorth} color={COLORS.cream} />
            <MetricCard label="Tổng khoản nợ" value={liabilities} color={COLORS.expense} />
          </div>
          <div className="space-y-3">
           {accounts.map((a) => (
            <div key={a.id} className="rounded-lg p-3" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border }}>
              <div className="flex items-center justify-between" style={{ gap: 12 }}>
                <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ flexShrink: 0 }}><AccIcon type={a.type} size={18} color={COLORS.cream} /></div>
                  <div style={{ minWidth: 0 }}>
                    <p className="sans text-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</p>
                    <p className="sans text-xs" style={{ color: COLORS.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}
                      {a.type === "credit" && ` · Chốt sao kê ${a.statementDay} · Hạn TT ${a.dueDay}${a.dueMonthOffset === 0 ? " (cùng tháng)" : " (tháng sau)"}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
                  <button onClick={() => startEditAccount(a)} style={{ color: COLORS.textMuted }}><Pencil size={14} /></button>
                  <button onClick={() => removeAccount(a.id)} style={{ color: COLORS.textMuted }}><Trash2 size={14} /></button>
                </div>
              </div>

              {a.type === "credit" ? (
                <div className="flex justify-between sans text-xs mt-2">
                  <span className="mono" style={{ color: COLORS.cream }}>Khả dụng: {fmtVND((a.creditLimit || 0) - Math.max(0, -(balances[a.id] || 0)) - (installmentReserved[a.id] || 0))}</span>
                  <span style={{ color: COLORS.expense }}>Dư nợ: {fmtVND(Math.max(0, -(balances[a.id] || 0)))}</span>
                </div>
              ) : (
                <p className="mono text-sm mt-2" style={{ color: COLORS.cream, textAlign: "right" }}>Số dư: {fmtVND(balances[a.id] || 0)}</p>
              )}

              <label className="sans text-xs flex items-center gap-2 mt-2" style={{ color: COLORS.textSecondary }}>
                <input type="checkbox" checked={a.includeNetWorth} onChange={() => toggleNetWorth(a.id)} style={{ width: "auto" }} />
                Tính vào tổng tài sản
              </label>
            </div>
          ))}
          </div>
          <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Cần thêm tài khoản mới? Vào tab Cài đặt.</p>
        </div>
      )}

      {/* CAI DAT */}
      {tab === "caidat" && (
        <div className="px-5 pt-5 space-y-7">
          <Section title="Thành viên" accent>
            <div className="flex flex-wrap gap-2 mb-2">
              {members.map((m) => <Chip key={m} label={m} onClick={() => renameMember(m)} onRemove={() => removeMember(m)} />)}
            </div>
            <div className="flex gap-2">
              <input placeholder="Thêm thành viên" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
              <button onClick={addMember} className="sans px-3 rounded-md" style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}>+</button>
            </div>
          </Section>

          <Section title="Danh mục chi tiêu / thu nhập" accent>
            <div className="flex gap-2 mb-3">
              {[{ v: "expense", l: "Chi tiêu" }, { v: "income", l: "Thu nhập" }].map((o) => (
                <Chip key={o.v} label={o.l} active={newCatType === o.v} onClick={() => setNewCatType(o.v)} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {(newCatType === "income" ? incomeCats : expenseCats).map((c) => (
                <Chip key={c} label={c} onClick={() => renameCategory(c, newCatType)} onRemove={() => newCatType === "income" ? removeCategory(c, "income") : removeCategory(c, "expense")} />
              ))}
            </div>
            <div className="flex gap-2">
              <input placeholder={`Thêm danh mục ${newCatType === "income" ? "thu nhập" : "chi tiêu"}`} value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
              <button onClick={addCategory} className="sans px-3 rounded-md" style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}>+</button>
            </div>
          </Section>

          <Section title="Nhà cung cấp / nơi mua (NCC)" accent>
            <div className="flex flex-wrap gap-2 mb-2">
              {vendors.map((v) => <Chip key={v} label={v} onClick={() => renameVendor(v)} onRemove={() => removeVendor(v)} />)}
            </div>
            <div className="flex gap-2">
              <input placeholder="Thêm NCC" value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} />
              <button onClick={addVendor} className="sans px-3 rounded-md" style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}>+</button>
            </div>
          </Section>

          <Section title="Thêm tài khoản mới" id="add-account-section" accent>
            <div className="space-y-2">
              <input placeholder="Tên tài khoản" value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })} />
              <select value={newAcc.type} onChange={(e) => setNewAcc({ ...newAcc, type: e.target.value })}>
                {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
             {newAcc.type === "credit" && (
                <>
                  <div className="flex gap-2">
                    <div className="flex-1"><label className="lbl">Ngày chốt sao kê</label><input type="number" min="1" max="31" value={newAcc.statementDay} onChange={(e) => setNewAcc({ ...newAcc, statementDay: e.target.value })} /></div>
                    <div className="flex-1"><label className="lbl">Ngày hạn TT</label><input type="number" min="1" max="31" value={newAcc.dueDay} onChange={(e) => setNewAcc({ ...newAcc, dueDay: e.target.value })} /></div>
                  </div>
                  <div>
                    <label className="lbl">Hạn thanh toán rơi vào</label>
                    <select value={newAcc.dueMonthOffset} onChange={(e) => setNewAcc({ ...newAcc, dueMonthOffset: Number(e.target.value) })}>
                      <option value={0}>Cùng tháng chốt sao kê</option>
                      <option value={1}>Tháng sau (mặc định)</option>
                    </select>
                  </div>
                  <div><label className="lbl">Hạn mức tín dụng</label><AmountInput value={newAcc.creditLimit} onChange={(v) => setNewAcc({ ...newAcc, creditLimit: v })} /></div>
                </>
              )}

              <label className="sans text-xs flex items-center gap-2" style={{ color: COLORS.textSecondary }}>
                <input type="checkbox" checked={newAcc.includeNetWorth} onChange={(e) => setNewAcc({ ...newAcc, includeNetWorth: e.target.checked })} style={{ width: "auto" }} />
                Tính vào tổng tài sản
              </label>
              <div><label className="lbl">Số dư đầu kỳ</label><AmountInput value={newAcc.openingBalance} onChange={(v) => setNewAcc({ ...newAcc, openingBalance: v })} /></div>
              <button onClick={saveAccount} className="w-full py-2.5 rounded-md sans text-sm" style={{ border: "1px solid " + COLORS.cream, color: COLORS.cream }}>
                  {editingAccId ? "Cập nhật tài khoản" : "+ Thêm tài khoản"}
                </button>
                {editingAccId && (
                  <button onClick={() => { setEditingAccId(null); setNewAcc({ name: "", type: "debit", statementDay: 15, dueDay: 5, includeNetWorth: true, openingBalance: "", creditLimit: "" }); }} className="w-full py-2 rounded-md sans text-xs" style={{ border: "1px solid " + COLORS.border, color: COLORS.textMuted }}>
                  Hủy sửa
                </button>
                )}
            </div>
          </Section>

          <Section title="Thêm ngân sách theo danh mục" id="add-budget-section" accent>
            <div className="flex gap-2">
              <select value={newBudget.category} onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })} style={{ flex: 1 }}>
                {expenseCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ width: 140 }}><AmountInput value={newBudget.limit} onChange={(v) => setNewBudget({ ...newBudget, limit: v })} placeholder="Hạn mức" /></div>
              <button onClick={saveBudget} className="sans px-3 rounded-md" style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}>+</button>
            </div>
          </Section>

          <Section title="Thêm khoản định kỳ" id="add-recurring-section" accent>
            <div className="space-y-2">
              <input placeholder="Tên khoản định kỳ (VD: Trả góp xe)" value={newRecurring.name} onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })} />

              <label className="sans text-xs flex items-center gap-2" style={{ color: COLORS.textSecondary }}>
                <input type="checkbox" checked={newRecurring.isInstallment} onChange={(e) => setNewRecurring({ ...newRecurring, isInstallment: e.target.checked })} style={{ width: "auto" }} />
                Khoản trả góp (tự tính số tiền mỗi kỳ theo nguyên giá)
              </label>

              {newRecurring.isInstallment ? (
                <div><label className="lbl">Nguyên giá</label><AmountInput value={newRecurring.principal} onChange={(v) => setNewRecurring({ ...newRecurring, principal: v })} /></div>
              ) : (
                <div style={{ width: "100%" }}><AmountInput value={newRecurring.amount} onChange={(v) => setNewRecurring({ ...newRecurring, amount: v })} placeholder="Số tiền mỗi lần" /></div>
              )}

              <div className="flex gap-2">
                <select value={newRecurring.category} onChange={(e) => setNewRecurring({ ...newRecurring, category: e.target.value })}>
                  {expenseCats.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={newRecurring.accountId} onChange={(e) => setNewRecurring({ ...newRecurring, accountId: e.target.value })}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div><label className="lbl">Thành viên</label>
                <select value={newRecurring.member} onChange={(e) => setNewRecurring({ ...newRecurring, member: e.target.value })}>
                  {members.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="lbl">
                  {accById(newRecurring.accountId)?.type === "credit" ? "Ngày phát sinh / mua hàng" : "Ngày ghi nhận"}
                </label>
                <input type="date" value={newRecurring.startDate} onChange={(e) => setNewRecurring({ ...newRecurring, startDate: e.target.value })} />
                {accById(newRecurring.accountId)?.type === "credit" && newRecurring.startDate && (
                  <p className="sans text-xs mt-1" style={{ color: COLORS.textMuted }}>
                    Kỳ ghi nhận đầu tiên: <span className="mono" style={{ color: COLORS.textSecondary }}>
                      {fmtDate((() => {
                        const acc = accById(newRecurring.accountId);
                        const d = occurrenceDate({ startDate: newRecurring.startDate, repeatUnit: "month", repeatValue: Number(newRecurring.repeatValue) || 1 }, acc, 0);
                        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                      })())}
                    </span>
                  </p>
                )}
              </div>

              <div className="flex gap-2 items-end">
                <div style={{ width: 90 }}><label className="lbl">Lặp mỗi</label><input type="text" inputMode="numeric" pattern="[0-9]*" value={newRecurring.repeatValue} onChange={(e) => setNewRecurring({ ...newRecurring, repeatValue: e.target.value.replace(/[^\d]/g, "") })} /></div>
                <div className="flex-1"><label className="lbl">Đơn vị</label>
                  <select value={newRecurring.repeatUnit} onChange={(e) => setNewRecurring({ ...newRecurring, repeatUnit: e.target.value })}>
                    {REPEAT_UNITS.map((u) => <option key={u.v} value={u.v}>{u.l}/lần</option>)}
                  </select>
                </div>
                <div style={{ width: 110 }}><label className="lbl">Số chu kỳ</label><input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0 = mãi" value={newRecurring.cycleCount} onChange={(e) => setNewRecurring({ ...newRecurring, cycleCount: e.target.value.replace(/[^\d]/g, "") })} /></div>
              </div>
              {newRecurring.isInstallment && newRecurring.principal && Number(newRecurring.cycleCount) > 0 && (
                <p className="sans text-xs" style={{ color: COLORS.textSecondary }}>→ Mỗi kỳ: {fmtVND(Number(newRecurring.principal) / Number(newRecurring.cycleCount))}</p>
              )}
              <button onClick={saveRecurring} className="w-full py-2.5 rounded-md sans text-sm" style={{ border: "1px solid " + COLORS.cream, color: COLORS.cream }}>
                {editingRecurringId ? "Cập nhật khoản định kỳ" : "+ Thêm khoản định kỳ"}
              </button>
              {editingRecurringId && (
                <button
                  onClick={() => {
                    setEditingRecurringId(null);
                    setNewRecurring({ name: "", amount: "", category: expenseCats[0] || "", member: members[0] || "", accountId: accounts[0]?.id || "", startDate: todayISO(), repeatValue: 1, repeatUnit: "month", cycleCount: "", principal: "", isInstallment: false });
                  }}
                  className="w-full py-2 rounded-md sans text-xs"
                  style={{ border: "1px solid " + COLORS.border, color: COLORS.textMuted }}
                >
                  Hủy sửa
                </button>
              )}
            </div>
          </Section>
        </div>
      )}

        {tab === "nhap" && (
          <button
            onClick={() => { resetEntryForm(); setEntryOpen(true); }}
            style={{ position: "fixed", bottom: 84, right: 20, width: 56, height: 56, borderRadius: "50%", background: COLORS.cream, color: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.4)", zIndex: 30, border: "none" }}
          >
            <Plus size={24} />
          </button>
        )}

        {entryOpen && (
          <div onClick={() => setEntryOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 45, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <div onClick={(e) => e.stopPropagation()} className="rounded-t-2xl p-4 w-full space-y-3" style={{ maxWidth: 480, background: COLORS.surface, border: "1px solid " + COLORS.border, maxHeight: "88vh", overflowY: "auto" }}>
              
              <div className="flex items-center justify-between">
                <p className="sans text-sm" style={{ color: COLORS.textSecondary }}>{editingId ? "Sửa giao dịch" : "Thêm giao dịch"}</p>
                <button onClick={() => setEntryOpen(false)} style={{ color: COLORS.textMuted }}><X size={18} /></button>
              </div>

              <div className="flex gap-2">
                {[
                  { v: "expense", l: "Chi tiêu", icon: TrendingDown },
                  { v: "income", l: "Thu nhập", icon: TrendingUp },
                  { v: "transfer", l: "Chuyển khoản", icon: ArrowRightLeft },
                ].map((o) => (
                  <button key={o.v} onClick={() => setEntryType(o.v)} className="sans flex-1 py-2.5 rounded-md flex items-center justify-center gap-1.5"
                    style={{ fontSize: 13, border: "1px solid " + (entryType === o.v ? COLORS.cream : COLORS.border), color: entryType === o.v ? COLORS.cream : COLORS.textSecondary, background: entryType === o.v ? "#3A3624" : "transparent" }}>
                    <o.icon size={14} /> {o.l}
                  </button>
                ))}
              </div>

              <div>
                <label className="lbl">Ngày</label>
                <div className="date-wrap">
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
              </div>
                            <div><label className="lbl">{isSplitEntry ? "Tổng số tiền hóa đơn" : "Số tiền"}</label><AmountInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></div>

              {entryType === "expense" && !editingId && (
                <label className="sans text-xs flex items-center gap-2" style={{ color: COLORS.textSecondary }}>
                  <input type="checkbox" checked={isSplitEntry} onChange={(e) => setIsSplitEntry(e.target.checked)} style={{ width: "auto" }} />
                  Hóa đơn gộp — tách thành nhiều danh mục/thành viên
                </label>
              )}

              {entryType === "expense" && isSplitEntry && (!editingId || editingGroupId) ? (
                 <>
                  <div className="flex gap-2">
                    <div className="flex-1"><label className="lbl">Tài khoản</label>
                      <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1"><label className="lbl">NCC (chung cả hóa đơn)</label>
                      <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="VD: Coopmart" />
                    </div>
                  </div>

                  {(() => {
                    const splitSum = splitLines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
                    const remaining = (Number(form.amount) || 0) - splitSum;
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="sans text-xs" style={{ color: COLORS.textSecondary }}>Tách khoản</p>
                          <span className="mono text-xs" style={{ color: remaining === 0 ? COLORS.accent : COLORS.expense }}>Còn lại: {fmtVND(remaining)}</span>
                        </div>
                        <div className="space-y-2">
                          {splitLines.map((l, i) => (
                            <div key={l.id} className="rounded-lg p-2.5" style={{ background: COLORS.surface2, border: "1px solid " + COLORS.border }}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="sans text-xs" style={{ color: COLORS.textMuted }}>Khoản {i + 1}</span>
                                <button onClick={() => setSplitLines((ls) => ls.length > 1 ? ls.filter((x) => x.id !== l.id) : ls)} style={{ color: COLORS.expense }}><Trash2 size={13} /></button>
                              </div>
                              <div className="chip-row flex gap-2 mb-2" style={{ overflowX: "auto" }}>
                                {expenseCats.map((c) => (
                                  <Chip key={c} label={c} active={l.category === c} onClick={() => setSplitLines((ls) => ls.map((x) => x.id === l.id ? { ...x, category: c } : x))} />
                                ))}
                              </div>
                              <div className="mb-2">
                                <AmountInput value={l.amount} onChange={(v) => setSplitLines((ls) => ls.map((x) => x.id === l.id ? { ...x, amount: v } : x))} placeholder="Số tiền" />
                              </div>
                              <div className="mb-2">
                                <select value={l.member} onChange={(e) => setSplitLines((ls) => ls.map((x) => x.id === l.id ? { ...x, member: e.target.value } : x))}>
                                  {members.map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </div>
                              <input value={l.note} onChange={(e) => setSplitLines((ls) => ls.map((x) => x.id === l.id ? { ...x, note: e.target.value } : x))} placeholder="Ghi chú khoản này" />
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => setSplitLines((ls) => [...ls, { id: "l" + ls.length + Date.now(), category: expenseCats[0] || "", member: members[0] || "", amount: remaining > 0 ? String(remaining) : "", note: "" }])}
                          className="sans text-xs mt-2 w-full py-2 rounded-md flex items-center justify-center gap-1.5"
                          style={{ border: "1px dashed " + COLORS.border, color: COLORS.textSecondary }}
                        >
                          <Plus size={13} /> Thêm khoản
                        </button>
                      </div>
                    );
                  })()}
                </>
              ) : entryType === "transfer" ? (
              
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><label className="lbl">Từ tài khoản</label>
                      <select value={form.fromAccountId} onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <ArrowRight size={16} style={{ marginTop: 20, color: COLORS.textMuted }} />
                    <div className="flex-1"><label className="lbl">Đến tài khoản</label>
                      <select value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label className="lbl">Ghi chú</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="VD: Chuyển tiết kiệm tháng 7" /></div>
                </>
              ) : (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="lbl" style={{ marginBottom: 0 }}>Danh mục</label>
                      <button onClick={() => { setEntryOpen(false); setTab("caidat"); }} className="sans" style={{ fontSize: 11, color: COLORS.textMuted }}>+ Thêm mới trong Cài đặt</button>
                    </div>
                    <div className="chip-row flex gap-2" style={{ overflowX: "auto", paddingBottom: 2 }}>
                      {(entryType === "income" ? incomeCats : expenseCats).map((c) => (
                        <Chip key={c} label={c} active={form.category === c} onClick={() => setForm({ ...form, category: c })} />
                      ))}
                    </div>
                  </div>

                  {entryType === "expense" && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="lbl" style={{ marginBottom: 0 }}>Nhà cung cấp / nơi mua</label>
                        <button onClick={() => { setEntryOpen(false); setTab("caidat"); }} className="sans" style={{ fontSize: 11, color: COLORS.textMuted }}>+ Thêm mới trong Cài đặt</button>
                      </div>
                      <div className="chip-row flex gap-2" style={{ overflowX: "auto", paddingBottom: 2 }}>
                        {vendors.map((v) => (
                          <Chip key={v} label={v} active={form.vendor === v} onClick={() => setForm({ ...form, vendor: form.vendor === v ? "" : v })} />
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <div className="flex-1"><label className="lbl">Thành viên</label>
                      <select value={form.member} onChange={(e) => setForm({ ...form, member: e.target.value })}>
                        {members.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="flex-1"><label className="lbl">Tài khoản</label>
                      <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div><label className="lbl">Ghi chú</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="VD: Ăn trưa với đồng nghiệp" /></div>

                  {entryType === "expense" && accById(form.accountId)?.type === "credit" && form.date && (
                    <div className="sans text-xs rounded-md px-3 py-2 flex items-center gap-2" style={{ background: "#26301F", color: COLORS.accent, border: "1px solid " + COLORS.border }}>
                      <ArrowRight size={13} /> Tiền sẽ bị trừ thực vào {(() => { const d = getCashFlowDate(form, accById(form.accountId)); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; })()}
                    </div>
                  )}
                </>
              )}

              <button onClick={saveTx} className="w-full py-3 rounded-md sans text-sm flex items-center justify-center gap-2" style={{ background: COLORS.cream, color: COLORS.bg, fontWeight: 600, border: "none" }}>
                <Plus size={16} /> {editingId ? "Cập nhật giao dịch" : "Lưu giao dịch"}
              </button>
              {editingId && (
                <button onClick={() => { setEntryOpen(false); resetEntryForm(); }} className="w-full py-2 rounded-md sans text-xs" style={{ border: "1px solid " + COLORS.border, color: COLORS.textMuted }}>
                  Hủy sửa
                </button>
              )}
            </div>
          </div>
        )}

        {detailTx && (() => {
          const acc = accById(detailTx.accountId);
          const toAcc = accById(detailTx.toAccountId);
          const color = detailTx.type === "income" ? COLORS.accent : detailTx.type === "transfer" ? COLORS.transfer : COLORS.expense;
          const sign = detailTx.type === "income" ? "+" : detailTx.type === "transfer" ? "" : "-";
          return (
            <div onClick={() => setDetailTx(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div onClick={(e) => e.stopPropagation()} className="rounded-t-2xl p-4 w-full space-y-3" style={{ maxWidth: 480, background: COLORS.surface, border: "1px solid " + COLORS.border, maxHeight: "88vh", overflowY: "auto" }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="sans text-sm" style={{ color: COLORS.textSecondary }}>Chi tiết giao dịch</p>
                  <button onClick={() => setDetailTx(null)} style={{ color: COLORS.textMuted }}><X size={18} /></button>
                </div>
                <p className="mono text-2xl mb-4" style={{ color }}>{sign}{fmtVND(detailTx.amount)}</p>
                <div className="space-y-2 sans text-sm">
                  <div className="flex justify-between"><span style={{ color: COLORS.textMuted }}>Ngày</span><span>{fmtDate(detailTx.date)}</span></div>
                  <div className="flex justify-between"><span style={{ color: COLORS.textMuted }}>Loại</span><span>{detailTx.type === "income" ? "Thu" : detailTx.type === "expense" ? "Chi" : "Chuyển khoản"}</span></div>
                  {detailTx.type === "transfer" ? (
                    <div className="flex justify-between"><span style={{ color: COLORS.textMuted }}>Từ / Đến</span><span>{acc?.name} → {toAcc?.name}</span></div>
                  ) : (
                    <>
                      <div className="flex justify-between"><span style={{ color: COLORS.textMuted }}>Danh mục</span><span>{detailTx.category || "—"}</span></div>
                      <div className="flex justify-between"><span style={{ color: COLORS.textMuted }}>Tài khoản</span><span>{acc?.name}</span></div>
                      {detailTx.vendor && <div className="flex justify-between"><span style={{ color: COLORS.textMuted }}>NCC</span><span>{detailTx.vendor}</span></div>}
                      {detailTx.member && <div className="flex justify-between"><span style={{ color: COLORS.textMuted }}>Thành viên</span><span>{detailTx.member}</span></div>}
                    </>
                  )}
                  {detailTx.note && <div className="flex justify-between"><span style={{ color: COLORS.textMuted }}>Ghi chú</span><span style={{ textAlign: "right", maxWidth: "60%" }}>{detailTx.note}</span></div>}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => {
                    setDetailTx(null);
                    if (detailTx.splitGroupId) {
                      const items = txs.filter((x) => x.splitGroupId === detailTx.splitGroupId);
                      const acc = accById(detailTx.accountId);
                      startEditSplitGroup({
                        id: detailTx.splitGroupId, accountId: detailTx.accountId,
                        accName: acc?.name, accType: acc?.type,
                        vendor: detailTx.vendor, note: detailTx.note, items,
                      });
                    } else {
                      startEditTx(detailTx);
                    }
                  }} className="flex-1 py-2.5 rounded-md sans text-sm flex items-center justify-center gap-2" style={{ border: "1px solid " + COLORS.cream, color: COLORS.cream }}>
                    <Pencil size={14} /> Sửa
                  </button>
                  <button onClick={() => { setDetailTx(null); removeTx(detailTx.id); }} className="flex-1 py-2.5 rounded-md sans text-sm flex items-center justify-center gap-2" style={{ border: "1px solid " + COLORS.expense, color: COLORS.expense }}>
                    <Trash2 size={14} /> Xóa
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {toast && (
          <div className="sans" style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            background: COLORS.cream, color: COLORS.bg, padding: "8px 16px", borderRadius: 999,
            fontSize: 12, fontWeight: 600, zIndex: 50, boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}>
            {toast}
          </div>
        )}

      <div className="fixed bottom-0 left-0 right-0 flex" style={{ background: COLORS.surface, borderTop: "1px solid " + COLORS.border }}>
        {[
          { id: "nhap", label: "Nhập", icon: Plus },
          { id: "baocao", label: "Báo cáo", icon: BarChart3 },
          { id: "ngansach", label: "Ngân sách", icon: PiggyBank },
          { id: "dinhky", label: "Định kỳ", icon: Repeat },
          { id: "taikhoan", label: "Tài khoản", icon: Wallet },
          { id: "caidat", label: "Cài đặt", icon: Settings },
        ].map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="flex-1 flex flex-col items-center gap-1 py-3 sans" style={{ color: tab === t.id ? COLORS.cream : COLORS.textMuted }}>
            <t.icon size={17} />
            <span style={{ fontSize: 10.5 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}