import supabase from "./supabase";

function mapFromDB(row) {
  return {
    id:         row.id,
    title:      row.title,
    category:   row.category,
    amount:     Number(row.amount),
    date:       row.expense_date,
    paidBy:     row.paid_by     || "",
    note:       row.note        || "",
    receiptUrl: row.receipt_url || null,
  };
}

function mapToDB(exp) {
  return {
    title:        exp.title,
    category:     exp.category,
    amount:       exp.amount,
    expense_date: exp.date,
    paid_by:      exp.paidBy      || null,
    note:         exp.note        || null,
    receipt_url:  exp.receiptUrl  || null,
  };
}

export async function getExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at",   { ascending: false });
  if (error) throw error;
  return (data || []).map(mapFromDB);
}

export async function addExpense(exp) {
  const { data, error } = await supabase
    .from("expenses")
    .insert(mapToDB(exp))
    .select()
    .single();
  if (error) throw error;
  return mapFromDB(data);
}

export async function deleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}
