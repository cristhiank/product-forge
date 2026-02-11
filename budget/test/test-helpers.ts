import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Create a temp copy of the real finance/ directory for testing.
 * Uses the actual budget data so tests validate against real schemas.
 */
export async function makeTempBudgetRoot(sourceRoot: string): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "budget-mcp-"));
  const dest = path.join(tmp, "finance");
  await copyDir(sourceRoot, dest);
  return {
    root: dest,
    cleanup: async () => {
      await fs.rm(tmp, { recursive: true, force: true });
    },
  };
}

/**
 * Create a minimal fixture directory with synthetic data for isolated tests.
 */
export async function makeTempFixture(): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "budget-mcp-fixture-"));
  const root = path.join(tmp, "finance");

  // Config
  await writeFixture(root, "config/settings.csv",
    `key,value,updated\ncurrency,USD,2026-02-06\nbudget_method,zero_based,2026-02-06\ncop_usd_rate,3600,2026-02-06\n`);

  await writeFixture(root, "config/family_profile.csv",
    `member_id,name,role,birth_year,notes\nM-001,Test User,head_of_household,,Primary earner\n`);

  await writeFixture(root, "config/expense_categories.csv",
    `category_id,category,subcategory,bucket,is_four_wall,default_priority,notes\nCAT-001,Housing,Rent,needs,yes,1,\nCAT-002,Utilities,Energy,needs,yes,2,\nCAT-003,Food,Groceries,needs,yes,3,\nCAT-010,Dining,Eating Out,wants,no,10,\nCAT-020,Savings,House Fund,savings,no,20,\n`);

  // 2026 year
  await writeFixture(root, "2026/income/income_sources.csv",
    `source_id,member_id,description,type,gross_monthly,net_monthly,frequency,start_date,end_date,notes\nINC-001,M-001,Salary,salary,16350.40,9886.18,semi-monthly,,,Test salary\n`);

  await writeFixture(root, "2026/budget/budget_annual.csv",
    `category_id,category,subcategory,bucket,monthly_budget,annual_budget,priority,notes\nCAT-001,Housing,Rent,needs,3557,42684,1,\nCAT-003,Food,Groceries,needs,800,9600,3,\nCAT-010,Dining,Eating Out,wants,700,8400,10,\nCAT-020,Savings,House Fund,savings,908,10896,20,\n`);

  await writeFixture(root, "2026/budget/budget_monthly.csv",
    `category_id,category,jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec,annual_total\nCAT-001,Rent,3557,3557,3557,3557,3557,3557,3557,3557,3557,3557,3557,3557,42684\nCAT-003,Groceries,800,800,800,800,800,800,800,800,800,800,800,800,9600\n`);

  await writeFixture(root, "2026/debt/debts.csv",
    `debt_id,description,type,original_amount,current_balance,interest_rate_annual,minimum_payment,due_day,start_date,term_months,lender,priority_snowball,priority_avalanche,notes\nDEBT-001,Credit Card,credit_card,,4500,11.75,250,,,,Test Bank,1,1,Test CC\nDEBT-002,Colombia Home,mortgage,,80000,11.12,1027,,,,Col Bank,2,1,Test mortgage\n`);

  await writeFixture(root, "2026/debt/payoff_plan.csv",
    `month,debt_id,description,payment,extra_payment,remaining_balance,interest_paid,cumulative_interest,notes\n2026-02,DEBT-001,Credit Card,1000,750,3544.06,44.06,44.06,Test\n2026-03,DEBT-001,Credit Card,1000,750,2578.85,34.73,78.79,Test\n2026-02,DEBT-002,Colombia Home,5038,4011,75703,741,741,Test\n2026-03,DEBT-002,Colombia Home,14666,13639,61739,701,1443,Test\n`);

  await writeFixture(root, "2026/expenses/recurring_expenses.csv",
    `expense_id,description,category_id,amount,frequency,due_day,auto_pay,vendor,notes\nEXP-001,Rent,CAT-001,3557,monthly,,yes,Landlord,\nEXP-002,Groceries,CAT-003,800,monthly,,no,,\n`);

  await writeFixture(root, "2026/goals/savings_goals.csv",
    `goal_id,description,target_amount,current_amount,monthly_contribution,start_date,target_date,priority,status\nGOAL-001,House Down Payment,50000,0,908,2026-02-01,2027-09-30,1,active\n`);

  await writeFixture(root, "2026/analysis/financial_health.csv",
    `date,dti_ratio,dti_status,savings_rate,savings_status,emergency_ratio,emergency_status,housing_ratio,housing_status,net_worth_estimate,data_source,notes\n2026-02-06,0.046,✅,0.148,🟡,3.2,🟡,0.248,✅,-64500,budget,Test\n`);

  await writeFixture(root, "2026/analysis/goal_allocation_strategy.csv",
    `section,parameter,scenario_a_colombia_first,scenario_b_house_first,scenario_c_balanced,notes\nCOLOMBIA,starting_balance,80000,80000,80000,Test\nCOLOMBIA,balance_dec_2026,15913,77017,38000,Test\nCOLOMBIA,total_interest_paid,5309,62334,12000,Test\nCOLOMBIA,interest_saved_vs_baseline,57025,0,50334,Test\n`);

  await writeFixture(root, "2026/snapshot_2026.csv",
    `metric,value,as_of_date,notes\ntotal_net_monthly_income,9886.18,2026-02-06,Test salary\ntotal_debt_balance,84500,2026-02-06,CC $4500 + Colombia $80000\ntotal_savings,20000,2026-02-06,Emergency fund\nestimated_net_worth,-64500,2026-02-06,Test\n`);

  await writeFixture(root, "2026/logs/planner_log.csv",
    `timestamp,action,task_type,details,files_modified\n2026-02-06T00:00:00,test_init,setup,Test fixture created,all\n`);

  await writeFixture(root, "2026/actuals/ledger_01.csv",
    `txn_id,date,type,category_id,category,source_or_dest,description,amount,payment_method,debt_id,goal_id,notes\n`);

  return {
    root,
    cleanup: async () => {
      await fs.rm(tmp, { recursive: true, force: true });
    },
  };
}

async function writeFixture(root: string, relPath: string, content: string): Promise<void> {
  const abs = path.join(root, relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      await copyDir(s, d);
    } else if (e.isFile()) {
      await fs.copyFile(s, d);
    }
  }
}
