import React, { useState, useMemo } from "react";
import {
  Plus, Wallet, CreditCard, Banknote, TrendingDown, TrendingUp, Trash2,
  ArrowRight, ArrowRightLeft, ArrowDownCircle, Landmark, PiggyBank, Repeat,
  Settings, Users, BarChart3, PieChart as PieChartIcon, X,Pencil,Search,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useEffect } from "react";
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
  };
}

function recFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    category: row.category,
    accountId: row.account_id,
    startDate: row.start_date,
    repeatValue: row.interval_value,
    repeatUnit: row.interval_unit === "nam" ? "year" : "month",
    cycleCount: row.cycle_count || 0,
    doneCount: row.done_count || 0,
  };
}
function recToDb(r) {
  return {
    name: r.name,
    amount: r.amount,
    category: r.category,
    account_id: r.accountId,
    start_date: r.startDate,
    interval_value: r.repeatValue,
    interval_unit: r.repeatUnit === "year" ? "nam" : "thang",
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
const REPEAT_UNITS = [{ v: "day", l: "ngày" }, { v: "month", l: "tháng" }, { v: "year", l: "năm" }];

function pad(n) { return String(n).padStart(2, "0"); }
function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
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
  const belongsNext = day > account.statementDay;
  const statementMonth = txDate.getMonth() + (belongsNext ? 1 : 0);
  const offset = account.dueMonthOffset ?? 1; // 0 = hạn TT cùng tháng chốt sao kê, 1 = hạn TT tháng sau
  const dueMonth = statementMonth + offset;
  return new Date(txDate.getFullYear(), dueMonth, account.dueDay);
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

function AmountInput({ value, onChange, placeholder = "0", align = "left" }) {
  const display = value ? Number(value).toLocaleString("vi-VN") : "";
  return (
    <input inputMode="numeric" className="mono" style={{ textAlign: align }} placeholder={placeholder}
      value={display} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))} />
  );
}

function Chip({ label, active, onClick, onRemove }) {
  return (
    <button onClick={onClick} className="sans" style={{
      fontSize: 12, padding: "6px 12px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6,
      border: "1px solid " + (active ? COLORS.cream : COLORS.border),
      background: active ? "#3A3624" : "transparent",
      color: active ? COLORS.cream : COLORS.textSecondary,
    }}>
      {label}
      {onRemove && <X size={11} onClick={(e) => { e.stopPropagation(); onRemove(); }} />}
    </button>
  );
}

function Section({ title, children, right, id }) {
  return (
    <div className="pt-2" id={id}>
      <div className="flex items-center justify-between mb-3">
        <p className="sans text-xs" style={{ color: COLORS.textSecondary, letterSpacing: 0.4 }}>{title}</p>
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

  function CategoryRow({ label, amount, max, color, txList }) {
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
              <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted }}>
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

function AccountReportCard({ account, data, balance, txList }) {
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
        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px dashed " + COLORS.border }}>
          {txList.map((t) => (
            <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted }}>
              <span>{fmtDate(t.date)} · {t.note || t.category || (t.type === "transfer" ? "Chuyển khoản" : "")}</span>
              <span className="mono" style={{ color: t.type === "income" ? COLORS.accent : t.type === "transfer" ? COLORS.transfer : COLORS.expense }}>
                {t.type === "income" ? "+" : t.type === "transfer" ? "" : "-"}{fmtVND(t.amount)}
              </span>
            </div>
          ))}
          {txList.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có giao dịch.</p>}
        </div>
      )}
    </div>
  );
}

function MemberReportCard({ member, data, txList }) {
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
            <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted }}>
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

function MonthReportCard({ monthKeyStr, data, txList }) {
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
            <div key={t.id} className="flex justify-between sans text-xs" style={{ color: COLORS.textMuted }}>
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

export default function App() {
  const [session, setSession] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [members, setMembers] = useState([]);
  const [expenseCats, setExpenseCats] = useState([]);
  const [incomeCats, setIncomeCats] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [txs, setTxs] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editingAccId, setEditingAccId] = useState(null);
  const [detailTx, setDetailTx] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState("");
  const [newAcc, setNewAcc] = useState({ name: "", type: "debit", statementDay: 15, dueDay: 5, dueMonthOffset: 1, includeNetWorth: true, openingBalance: "", creditLimit: "" });

  const [tab, setTab] = useState("nhap");
  const [entryType, setEntryType] = useState("expense");
  const [txPeriod, setTxPeriod] = useState("month");
  const [reportView, setReportView] = useState("danhmuc");
  const [dateBasis, setDateBasis] = useState("phatsinh");
  const [reportFrom, setReportFrom] = useState(firstDayThisMonth());
  const [reportTo, setReportTo] = useState(lastDayNextMonth());

  const accById = (id) => accounts.find((a) => a.id === id);

  const [form, setForm] = useState({
  date: todayISO(), amount: "", category: "", member: "",
  accountId: "", vendor: "", note: "", fromAccountId: "", toAccountId: "",
  });

  const [newCatType, setNewCatType] = useState("expense");
  const [newCatName, setNewCatName] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newRecurring, setNewRecurring] = useState({ name: "", amount: "", category: "", accountId: "", startDate: todayISO(), repeatValue: 1, repeatUnit: "month", cycleCount: "", principal: "", isInstallment: false });
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
  } else {
    const { data, error } = await supabase.from("transactions").insert(payload).select().single();
    if (error) { console.error(error); return; }
    setTxs([txFromDb(data), ...txs]);
  }
  setForm({ ...form, amount: "", note: "", vendor: "" });
  showToast("Đã lưu giao dịch");
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
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  async function addRecurring() {
    if (!newRecurring.name.trim() || !newRecurring.amount) return;
    const payload = recToDb({ ...newRecurring, amount: Number(newRecurring.amount), repeatValue: Number(newRecurring.repeatValue) || 1 });
    const { data, error } = await supabase.from("recurring_items").insert(payload).select().single();
    if (error) { console.error(error); return; }
    setRecurring([...recurring, recFromDb(data)]);
    setNewRecurring({ name: "", amount: "", category: expenseCats[0] || "", accountId: accounts[0]?.id || "", startDate: todayISO(), repeatValue: 1, repeatUnit: "month", cycleCount: "", principal: "", isInstallment: false });
    showToast("Đã thêm khoản định kỳ");
  }

  async function removeRecurring(id) {
  if (!window.confirm("Xóa khoản định kỳ này?")) return;
  const { error } = await supabase.from("recurring_items").delete().eq("id", id);
  if (error) { console.error(error); return; }
  setRecurring(recurring.filter((r) => r.id !== id));
  showToast("Đã xóa khoản định kỳ");
  }

 async function logRecurring(r) {
  if (r.cycleCount > 0 && r.doneCount >= r.cycleCount) return;
  const payload = txToDb({ type: "expense", date: todayISO(), amount: r.amount, category: r.category, member: members[0], accountId: r.accountId, note: r.name + " (định kỳ)" });
  const { data, error } = await supabase.from("transactions").insert(payload).select().single();
  if (error) { console.error(error); return; }
  setTxs([txFromDb(data), ...txs]);
  showToast("Đã ghi nhận");

  const { error: err2 } = await supabase.from("recurring_items").update({ done_count: r.doneCount + 1 }).eq("id", r.id);
  if (err2) { console.error(err2); return; }
  setRecurring(recurring.map((x) => x.id === r.id ? { ...x, doneCount: x.doneCount + 1 } : x));
  }

  async function addBudget() {
    if (!newBudget.limit) return;
    const existing = budgets.find((b) => b.category === newBudget.category);
    if (existing) {
      const { error } = await supabase.from("budgets").update({ monthly_limit: Number(newBudget.limit) }).eq("id", existing.id);
      if (error) { console.error(error); return; }
      setBudgets(budgets.map((b) => b.category === newBudget.category ? { ...b, limit: Number(newBudget.limit) } : b));
    } else {
      const { data, error } = await supabase.from("budgets").insert({ category: newBudget.category, monthly_limit: Number(newBudget.limit) }).select().single();
      if (error) { console.error(error); return; }
      setBudgets([...budgets, { id: data.id, category: data.category, limit: data.monthly_limit }]);
    }
    setNewBudget({ category: expenseCats[0] || "", limit: "" });
    showToast("Đã lưu ngân sách");
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

  const balances = useMemo(() => {
    const bal = {};
    accounts.forEach((a) => (bal[a.id] = a.openingBalance || 0));  // ← đổi từ 0 thành a.openingBalance
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
      g[t.member] = g[t.member] || { income: 0, expense: 0 };
      g[t.member][t.type] += t.amount;
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

  const periodTxs = useMemo(() => txs.filter((t) => t.type !== "transfer" && inPeriod(t.date, txPeriod)), [txs, txPeriod]);
  const periodIncome = periodTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const periodExpense = periodTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const recentList = useMemo(() => {
  const q = searchQuery.trim().toLowerCase();
    return txs.filter((t) => {
      if (!inPeriod(t.date, txPeriod)) return false;
      if (!q) return true;
      return [t.note, t.category, t.vendor, t.member].some((f) => (f || "").toLowerCase().includes(q));
    });
  }, [txs, txPeriod, searchQuery]);

  const inputStyle = `
  * { box-sizing: border-box; }
  html, body { overflow-x: clip; max-width: 100vw; }
  html { font-size: 18.4px; }
  input, select {
    background: ${COLORS.surface2}; border: 1px solid ${COLORS.border}; color: ${COLORS.textPrimary};
    border-radius: 6px; padding: 10px 12px; font-size: 16px; width: 100%;
  }
  input[type="date"] {
    width: 100%;
    box-sizing: border-box;
    border: none;
    background: transparent;
    padding: 10px 8px;
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
          <div><label className="lbl">Số tiền</label><AmountInput value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} /></div>

          {entryType === "transfer" ? (
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
                <div className="flex items-center justify-between mb-2">
                  <label className="lbl" style={{ marginBottom: 0 }}>Danh mục</label>
                  <button onClick={() => setTab("caidat")} className="sans" style={{ fontSize: 11, color: COLORS.textMuted }}>+ Thêm mới trong Cài đặt</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(entryType === "income" ? incomeCats : expenseCats).map((c) => (
                    <Chip key={c} label={c} active={form.category === c} onClick={() => setForm({ ...form, category: c })} />
                  ))}
                </div>
              </div>

              {entryType === "expense" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="lbl" style={{ marginBottom: 0 }}>Nhà cung cấp / nơi mua</label>
                    <button onClick={() => setTab("caidat")} className="sans" style={{ fontSize: 11, color: COLORS.textMuted }}>+ Thêm mới trong Cài đặt</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {vendors.map((v) => (
                      <Chip key={v} label={v} active={form.vendor === v} onClick={() => setForm({ ...form, vendor: form.vendor === v ? "" : v })} />
                    ))}
                  </div>
                </div>
              )}

              <div><label className="lbl">Thành viên</label>
                <select value={form.member} onChange={(e) => setForm({ ...form, member: e.target.value })}>
                  {members.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div><label className="lbl">Tài khoản</label>
                <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div><label className="lbl">Ghi chú</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="VD: Ăn trưa với đồng nghiệp" /></div>

              {entryType === "expense" && accById(form.accountId)?.type === "credit" && form.date && (
                <div className="sans text-xs rounded-md px-3 py-2 flex items-center gap-2" style={{ background: "#26301F", color: COLORS.accent, border: "1px solid " + COLORS.border }}>
                  <ArrowRight size={13} /> Tiền sẽ bị trừ thực vào {(() => {
                    const d = getCashFlowDate(form, accById(form.accountId));
                    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                  })()}
                </div>
              )}
            </>
          )}

          <button onClick={saveTx} className="w-full py-3 rounded-md sans text-sm flex items-center justify-center gap-2" style={{ background: COLORS.cream, color: COLORS.bg, fontWeight: 600, border: "none" }}>
            <Plus size={16} /> {editingId ? "Cập nhật giao dịch" : "Lưu giao dịch"}
          </button>
          {editingId && (
            <button onClick={() => { setEditingId(null); setForm({ ...form, amount: "", note: "", vendor: "" }); }} className="w-full py-2 rounded-md sans text-xs" style={{ border: "1px solid " + COLORS.border, color: COLORS.textMuted }}>
              Hủy sửa
            </button>
          )}

         <div className="pt-2">
            <div style={{ position: "sticky", top: 0, zIndex: 10, background: COLORS.bg, paddingTop: 8, paddingBottom: 8, marginBottom: 4 }}>
              <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex gap-2" style={{ overflowX: "auto" }}>
                {[{ v: "today", l: "Hôm nay" }, { v: "week", l: "Tuần này" }, { v: "month", l: "Tháng này" }, { v: "all", l: "Tất cả" }].map((o) => (
                  <Chip key={o.v} label={o.l} active={txPeriod === o.v} onClick={() => setTxPeriod(o.v)} />
                ))}
              </div>
              <button
                onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setSearchQuery(""); }}
                style={{ color: searchOpen ? COLORS.cream : COLORS.textMuted, flexShrink: 0 }}
              >
                <Search size={18} />
              </button>
            </div>

            {searchOpen && (
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo ghi chú, danh mục, NCC, thành viên..."
                className="mb-3"
              />
            )}
              <div className="flex gap-3">
                <MetricCard label="Tổng thu" value={periodIncome} color={COLORS.accent} />
                <MetricCard label="Tổng chi" value={periodExpense} color={COLORS.expense} />
              </div>
            </div>
            
           {recentList.map((t) => {
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
                      {t.type === "transfer" ? `${acc?.name} → ${accById(t.toAccountId)?.name}` : `${t.category}${t.vendor ? " · " + t.vendor : ""}`} · {fmtDate(t.date)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
                  <span className="mono text-sm" style={{ color }}>{sign}{fmtVND(t.amount)}</span>
                  <div className="flex items-center gap-3">
                    <button onClick={(e) => { e.stopPropagation(); startEditTx(t); }} style={{ color: COLORS.textMuted }}><Pencil size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); removeTx(t.id); }} style={{ color: COLORS.textMuted }}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}

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
          ].map((o) => <Chip key={o.v} label={o.l} active={reportView === o.v} onClick={() => setReportView(o.v)} />)}
        </div>
        
          {reportView === "danhmuc" && (
            <div className="space-y-6">
              <div>
                <p className="sans text-xs mb-2" style={{ color: COLORS.textSecondary }}>Chi tiêu theo danh mục (bấm để xem chi tiết)</p>
                {Object.entries(byCategory.exp).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                  const max = Math.max(...Object.values(byCategory.exp));
                  const txList = filteredTxs.filter((t) => t.type === "expense" && t.category === cat);
                  return <CategoryRow key={cat} label={cat} amount={amt} max={max} color={COLORS.expense} txList={txList} />;
                })}
                {pieExpense.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có dữ liệu trong khoảng ngày đã chọn.</p>}
              </div>
              <div>
                <p className="sans text-xs mb-2" style={{ color: COLORS.textSecondary }}>Thu nhập theo danh mục (bấm để xem chi tiết)</p>
                {Object.entries(byCategory.inc).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
                  const max = Math.max(...Object.values(byCategory.inc));
                  const txList = filteredTxs.filter((t) => t.type === "income" && t.category === cat);
                  return <CategoryRow key={cat} label={cat} amount={amt} max={max} color={COLORS.accent} txList={txList} />;
                })}
              </div>
            </div>
          )}

          {reportView === "tytrong" && (
            <div className="space-y-8">
              <div>
                <p className="sans text-xs mb-1" style={{ color: COLORS.textSecondary }}>Tỷ trọng chi tiêu</p>
                {pieExpense.length > 0 ? (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieExpense}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieExpense.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip
                          formatter={(v, n, props) => {
                            const total = pieExpense.reduce((s, d) => s + d.value, 0);
                            return [`${fmtVND(v)} (${((v / total) * 100).toFixed(1)}%)`, n];
                          }}
                          contentStyle={{ background: COLORS.surface, border: "1px solid " + COLORS.border, fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, color: COLORS.textSecondary }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có dữ liệu.</p>}
              </div>
              <div>
                <p className="sans text-xs mb-1" style={{ color: COLORS.textSecondary }}>Tỷ trọng thu nhập</p>
                {pieIncome.length > 0 ? (
                  <div style={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieIncome}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieIncome.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip
                          formatter={(v, n, props) => {
                            const total = pieExpense.reduce((s, d) => s + d.value, 0);
                            return [`${fmtVND(v)} (${((v / total) * 100).toFixed(1)}%)`, n];
                          }}
                          contentStyle={{ background: COLORS.surface, border: "1px solid " + COLORS.border, fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, color: COLORS.textSecondary }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có dữ liệu.</p>}
              </div>
            </div>
          )}

          {reportView === "taikhoan" && (
            <div className="space-y-2">
              {accounts.map((a) => {
                const d = byAccount[a.id] || { income: 0, expense: 0 };
                const txList = filteredTxs.filter((t) => t.accountId === a.id || t.toAccountId === a.id);
                return <AccountReportCard key={a.id} account={a} data={d} balance={balances[a.id] || 0} txList={txList} />;
              })}
            </div>
          )}

          {reportView === "thanhvien" && (
            <div className="space-y-2">
              {Object.entries(byMember).map(([m, d]) => {
                const txList = filteredTxs.filter((t) => t.type !== "transfer" && t.member === m);
                return <MemberReportCard key={m} member={m} data={d} txList={txList} />;
              })}
            </div>
          )}

          {reportView === "ncc" && (
            <div>
              <p className="sans text-xs mb-2" style={{ color: COLORS.textSecondary }}>Chi tiêu theo NCC (bấm để xem chi tiết)</p>
              {Object.entries(byVendor).sort((a, b) => b[1] - a[1]).map(([ven, amt]) => {
                const max = Math.max(...Object.values(byVendor));
                const txList = filteredTxs.filter((t) => t.type === "expense" && t.vendor === ven);
                return <CategoryRow key={ven} label={ven} amount={amt} max={max} color={COLORS.expense} txList={txList} />;
              })}
              {Object.keys(byVendor).length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Không có dữ liệu NCC trong khoảng ngày đã chọn.</p>}
            </div>
          )}

          {reportView === "tonghop" && (
            <div className="space-y-4">
              {monthlyTotals.map(([key, d]) => {
                const txList = filteredTxs.filter((t) => t.type !== "transfer" && monthKey(effDate(t)) === key);
                return <MonthReportCard key={key} monthKeyStr={key} data={d} txList={txList} />;
              })}
            </div>
          )}
        </div>
      )}

      {/* NGAN SACH */}
      {tab === "ngansach" && (
        <div className="px-5 pt-5 space-y-7">
          <Section title="Ngân sách theo danh mục (tháng hiện tại)">
            <div className="space-y-3">
              {budgets.map((b) => {
                const spent = currentMonthExpenseByCat[b.category] || 0;
                const pct = Math.min(100, (spent / b.limit) * 100);
                const over = spent > b.limit;
                return (
                  <div key={b.category} className="rounded-lg p-3" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="sans text-sm">{b.category}</span>
                      <button onClick={() => removeBudget(b.category)} style={{ color: COLORS.textMuted }}><Trash2 size={13} /></button>
                    </div>
                    <div className="h-2 rounded-full mb-1.5" style={{ background: COLORS.surface2 }}>
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: over ? COLORS.expense : COLORS.accent }} />
                    </div>
                    <p className="mono text-xs" style={{ color: over ? COLORS.expense : COLORS.textSecondary }}>{fmtVND(spent)} / {fmtVND(b.limit)}</p>
                  </div>
                );
              })}
              {budgets.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Chưa có ngân sách nào — thêm trong Cài đặt.</p>}
            </div>
          </Section>

          <Section title="Chi phí định kỳ (trả góp, chi phí cố định)">
            <div className="space-y-2">
              {recurring.map((r) => {
                const done = r.cycleCount > 0 && r.doneCount >= r.cycleCount;
                return (
                  <div key={r.id} className="rounded-lg p-3" style={{ background: COLORS.surface, border: "1px solid " + COLORS.border }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Repeat size={15} style={{ color: COLORS.cream }} />
                        <div>
                          <p className="sans text-sm">{r.name}</p>
                          <p className="sans text-xs" style={{ color: COLORS.textMuted }}>
                            {r.category} · mỗi {r.repeatValue} {unitLabel(r.repeatUnit)}/lần · từ {fmtDate(r.startDate)} · {r.cycleCount > 0 ? `${r.doneCount}/${r.cycleCount} chu kỳ` : `đã ghi ${r.doneCount} lần, không giới hạn`}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => removeRecurring(r.id)} style={{ color: COLORS.textMuted }}><Trash2 size={13} /></button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="mono text-xs">{fmtVND(r.amount)} · {accById(r.accountId)?.name}</span>
                      <button onClick={() => logRecurring(r)} disabled={done} className="sans text-xs px-2 py-1 rounded"
                        style={{ border: "1px solid " + (done ? COLORS.textMuted : COLORS.accent), color: done ? COLORS.textMuted : COLORS.accent }}>
                        {done ? "Đã hoàn thành" : "Ghi nhận"}
                      </button>
                    </div>
                  </div>
                );
              })}
              {recurring.length === 0 && <p className="sans text-xs" style={{ color: COLORS.textMuted }}>Chưa có khoản định kỳ — thêm trong Cài đặt.</p>}
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
                  <span className="mono" style={{ color: COLORS.cream }}>Khả dụng: {fmtVND((a.creditLimit || 0) - Math.max(0, -(balances[a.id] || 0)))}</span>
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
          <Section title="Thành viên">
            <div className="flex flex-wrap gap-2 mb-2">
              {members.map((m) => <Chip key={m} label={m} onRemove={() => removeMember(m)} />)}
            </div>
            <div className="flex gap-2">
              <input placeholder="Thêm thành viên" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} />
              <button onClick={addMember} className="sans px-3 rounded-md" style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}>+</button>
            </div>
          </Section>

          <Section title="Danh mục chi tiêu / thu nhập">
            <div className="flex gap-2 mb-3">
              {[{ v: "expense", l: "Chi tiêu" }, { v: "income", l: "Thu nhập" }].map((o) => (
                <Chip key={o.v} label={o.l} active={newCatType === o.v} onClick={() => setNewCatType(o.v)} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {(newCatType === "income" ? incomeCats : expenseCats).map((c) => (
                <Chip key={c} label={c} onRemove={() => newCatType === "income" ? removeCategory(c, "income") : removeCategory(c, "expense")} />
              ))}
            </div>
            <div className="flex gap-2">
              <input placeholder={`Thêm danh mục ${newCatType === "income" ? "thu nhập" : "chi tiêu"}`} value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
              <button onClick={addCategory} className="sans px-3 rounded-md" style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}>+</button>
            </div>
          </Section>

          <Section title="Nhà cung cấp / nơi mua (NCC)">
            <div className="flex flex-wrap gap-2 mb-2">
              {vendors.map((v) => <Chip key={v} label={v} onRemove={() => removeVendor(v)} />)}
            </div>
            <div className="flex gap-2">
              <input placeholder="Thêm NCC" value={newVendorName} onChange={(e) => setNewVendorName(e.target.value)} />
              <button onClick={addVendor} className="sans px-3 rounded-md" style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}>+</button>
            </div>
          </Section>

          <Section title="Thêm tài khoản mới" id="add-account-section">
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

          <Section title="Thêm ngân sách theo danh mục">
            <div className="flex gap-2">
              <select value={newBudget.category} onChange={(e) => setNewBudget({ ...newBudget, category: e.target.value })} style={{ flex: 1 }}>
                {expenseCats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ width: 140 }}><AmountInput value={newBudget.limit} onChange={(v) => setNewBudget({ ...newBudget, limit: v })} placeholder="Hạn mức" /></div>
              <button onClick={addBudget} className="sans px-3 rounded-md" style={{ border: "1px solid " + COLORS.border, color: COLORS.textSecondary }}>+</button>
            </div>
          </Section>

          <Section title="Thêm khoản định kỳ">
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
              <div><label className="lbl">Ngày bắt đầu</label><input type="date" value={newRecurring.startDate} onChange={(e) => setNewRecurring({ ...newRecurring, startDate: e.target.value })} /></div>
              <div className="flex gap-2 items-end">
                <div style={{ width: 90 }}><label className="lbl">Lặp mỗi</label><input type="number" min="1" value={newRecurring.repeatValue} onChange={(e) => setNewRecurring({ ...newRecurring, repeatValue: e.target.value })} /></div>
                <div className="flex-1"><label className="lbl">Đơn vị</label>
                  <select value={newRecurring.repeatUnit} onChange={(e) => setNewRecurring({ ...newRecurring, repeatUnit: e.target.value })}>
                    {REPEAT_UNITS.map((u) => <option key={u.v} value={u.v}>{u.l}/lần</option>)}
                  </select>
                </div>
                <div style={{ width: 110 }}><label className="lbl">Số chu kỳ</label><input type="number" min="0" placeholder="0 = mãi" value={newRecurring.cycleCount} onChange={(e) => setNewRecurring({ ...newRecurring, cycleCount: e.target.value })} /></div>
                {newRecurring.isInstallment && newRecurring.principal && Number(newRecurring.cycleCount) > 0 && (
                  <p className="sans text-xs" style={{ color: COLORS.textSecondary }}>
                    → Mỗi kỳ: {fmtVND(Number(newRecurring.principal) / Number(newRecurring.cycleCount))}
                  </p>
                )}
              </div>
              <button onClick={addRecurring} className="w-full py-2.5 rounded-md sans text-sm" style={{ border: "1px solid " + COLORS.cream, color: COLORS.cream }}>+ Thêm khoản định kỳ</button>
            </div>
          </Section>
        </div>
      )}

        {detailTx && (() => {
          const acc = accById(detailTx.accountId);
          const toAcc = accById(detailTx.toAccountId);
          const color = detailTx.type === "income" ? COLORS.accent : detailTx.type === "transfer" ? COLORS.transfer : COLORS.expense;
          const sign = detailTx.type === "income" ? "+" : detailTx.type === "transfer" ? "" : "-";
          return (
            <div onClick={() => setDetailTx(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div onClick={(e) => e.stopPropagation()} className="rounded-t-2xl p-5 w-full" style={{ maxWidth: 480, background: COLORS.surface, border: "1px solid " + COLORS.border }}>
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
                  <button onClick={() => { setDetailTx(null); startEditTx(detailTx); }} className="flex-1 py-2.5 rounded-md sans text-sm flex items-center justify-center gap-2" style={{ border: "1px solid " + COLORS.cream, color: COLORS.cream }}>
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
