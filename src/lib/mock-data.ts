export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  status: 'completed' | 'pending' | 'overdue';
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  client: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue' | 'draft';
  issueDate: string;
  dueDate: string;
  items: { description: string; quantity: number; rate: number }[];
}

export const transactions: Transaction[] = [
  { id: '1', date: '2026-03-30', description: 'Client Payment - TechCorp', amount: 15000, type: 'inflow', category: 'Revenue', status: 'completed' },
  { id: '2', date: '2026-03-29', description: 'Office Rent', amount: 3500, type: 'outflow', category: 'Rent', status: 'completed' },
  { id: '3', date: '2026-03-28', description: 'Consulting Fee - StartupXYZ', amount: 8500, type: 'inflow', category: 'Revenue', status: 'completed' },
  { id: '4', date: '2026-03-27', description: 'Software Subscriptions', amount: 890, type: 'outflow', category: 'Software', status: 'completed' },
  { id: '5', date: '2026-03-26', description: 'Freelancer Payment', amount: 2200, type: 'outflow', category: 'Contractors', status: 'pending' },
  { id: '6', date: '2026-03-25', description: 'Product Sales', amount: 12300, type: 'inflow', category: 'Revenue', status: 'completed' },
  { id: '7', date: '2026-03-24', description: 'Marketing Campaign', amount: 4500, type: 'outflow', category: 'Marketing', status: 'completed' },
  { id: '8', date: '2026-03-23', description: 'Retainer - FinanceHub', amount: 6000, type: 'inflow', category: 'Revenue', status: 'completed' },
  { id: '9', date: '2026-03-22', description: 'Insurance Premium', amount: 1200, type: 'outflow', category: 'Insurance', status: 'completed' },
  { id: '10', date: '2026-03-21', description: 'Employee Salaries', amount: 18500, type: 'outflow', category: 'Payroll', status: 'completed' },
];

export const invoices: Invoice[] = [
  { id: '1', invoiceNumber: 'INV-001', client: 'TechCorp Ltd', amount: 15000, status: 'paid', issueDate: '2026-03-01', dueDate: '2026-03-30', items: [{ description: 'Web Development', quantity: 1, rate: 15000 }] },
  { id: '2', invoiceNumber: 'INV-002', client: 'StartupXYZ', amount: 8500, status: 'pending', issueDate: '2026-03-10', dueDate: '2026-04-10', items: [{ description: 'Consulting', quantity: 17, rate: 500 }] },
  { id: '3', invoiceNumber: 'INV-003', client: 'FinanceHub', amount: 6000, status: 'paid', issueDate: '2026-02-15', dueDate: '2026-03-15', items: [{ description: 'Monthly Retainer', quantity: 1, rate: 6000 }] },
  { id: '4', invoiceNumber: 'INV-004', client: 'GreenEnergy Co', amount: 22000, status: 'overdue', issueDate: '2026-02-01', dueDate: '2026-03-01', items: [{ description: 'System Integration', quantity: 1, rate: 22000 }] },
  { id: '5', invoiceNumber: 'INV-005', client: 'RetailMax', amount: 4200, status: 'draft', issueDate: '2026-03-28', dueDate: '2026-04-28', items: [{ description: 'UI Design', quantity: 42, rate: 100 }] },
];

export const monthlyData = [
  { month: 'Oct', inflow: 42000, outflow: 31000 },
  { month: 'Nov', inflow: 48000, outflow: 35000 },
  { month: 'Dec', inflow: 55000, outflow: 38000 },
  { month: 'Jan', inflow: 51000, outflow: 36000 },
  { month: 'Feb', inflow: 58000, outflow: 40000 },
  { month: 'Mar', inflow: 62000, outflow: 42000 },
];

export const pnlData = {
  revenue: [
    { label: 'Product Sales', amount: 185000 },
    { label: 'Service Revenue', amount: 124000 },
    { label: 'Consulting Fees', amount: 56000 },
    { label: 'Other Income', amount: 12000 },
  ],
  expenses: [
    { label: 'Salaries & Wages', amount: 148000 },
    { label: 'Rent & Utilities', amount: 42000 },
    { label: 'Marketing', amount: 28000 },
    { label: 'Software & Tools', amount: 15000 },
    { label: 'Insurance', amount: 8400 },
    { label: 'Professional Fees', amount: 12000 },
    { label: 'Depreciation', amount: 9600 },
    { label: 'Other Expenses', amount: 7200 },
  ],
};

export const vatData = {
  outputVAT: 75400,
  inputVAT: 42100,
  netVAT: 33300,
  nextDeadline: '2026-04-07',
  quarters: [
    { quarter: 'Q1 2025', output: 68000, input: 38000, net: 30000, status: 'filed' as const },
    { quarter: 'Q2 2025', output: 72000, input: 40000, net: 32000, status: 'filed' as const },
    { quarter: 'Q3 2025', output: 70500, input: 39200, net: 31300, status: 'filed' as const },
    { quarter: 'Q4 2025', output: 74000, input: 41500, net: 32500, status: 'filed' as const },
    { quarter: 'Q1 2026', output: 75400, input: 42100, net: 33300, status: 'due' as const },
  ],
};

export const payeData = {
  totalGrossPay: 148000,
  totalTax: 29600,
  totalNI: 18500,
  totalNetPay: 99900,
  employees: [
    { name: 'Sarah Johnson', role: 'CTO', gross: 6500, tax: 1560, ni: 780, net: 4160 },
    { name: 'James Chen', role: 'Lead Developer', gross: 5200, tax: 1144, ni: 624, net: 3432 },
    { name: 'Emma Wilson', role: 'Designer', gross: 4200, tax: 840, ni: 504, net: 2856 },
    { name: 'David Brown', role: 'Marketing Manager', gross: 4500, tax: 945, ni: 540, net: 3015 },
    { name: 'Lisa Anderson', role: 'Accountant', gross: 4100, tax: 820, ni: 492, net: 2788 },
  ],
};
