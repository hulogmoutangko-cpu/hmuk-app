import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// IMPORT THE NEW CLIENT COMPONENT HERE:
import DashboardClient from "./DashboardClient"; 

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ---------------------------------------------------------
  // GET PROFILE
  // ---------------------------------------------------------
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, first_name, last_name, profile_picture_url, signature_url, referral_code")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  // ---------------------------------------------------------
  // UNREAD NOTIFICATIONS
  // ---------------------------------------------------------
  const { count: unreadCount } = await supabase
    .from("user_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  // ---------------------------------------------------------
  // GET USER'S CO-OP ACCOUNTS
  // ---------------------------------------------------------
  const { data: accounts } = await supabase
    .from("coop_accounts")
    .select("id, account_name, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: true });

  const accountIds = (accounts ?? []).map((a) => a.id);

  // ---------------------------------------------------------
  // FINANCIAL VARIABLES
  // ---------------------------------------------------------
  let totalContribution = 0;
  let interestEarned = 0;
  let interestPerAccountShare = 0;
  let currentLoanAmount = 0;
  let referralBonusEarned = 0;

  // ---------------------------------------------------------
  // USER FINANCIAL DATA
  // ---------------------------------------------------------
  if (accountIds.length > 0) {
    const [
      { data: contributions },
      { data: loans },
      { data: interestPool },
    ] = await Promise.all([
      supabase.from("contributions").select("amount").in("account_id", accountIds).eq("status", "approved"),
      supabase.from("loans").select("id, principal_amount").in("account_id", accountIds).in("status", ["approved", "active", "disbursed", "Approved", "Active"]),
      supabase.rpc("get_interest_pool_stats"),
    ]);

    totalContribution = (contributions ?? []).reduce((sum, c) => sum + Number(c.amount || 0), 0);

    const poolStats = interestPool?.[0];
    const totalSystemAccounts = Number(poolStats?.total_accounts || 0);
    const totalApprovedInterest = Number(poolStats?.total_interest || 0);
    const totalPenaltiesSum = Number(poolStats?.total_penalties || 0);

    const totalSystemPool = totalApprovedInterest + totalPenaltiesSum;
    const systemAccountCount = totalSystemAccounts > 0 ? totalSystemAccounts : 1;

    interestPerAccountShare = totalSystemPool / systemAccountCount;
    interestEarned = interestPerAccountShare * accountIds.length;

    const activeLoanIds = (loans ?? []).map((l) => l.id);
    let totalPrincipalPaid = 0;

    if (activeLoanIds.length > 0) {
      const { data: payments } = await supabase
        .from("loan_payments")
        .select("principal_portion")
        .in("loan_id", activeLoanIds)
        .eq("status", "approved");

      totalPrincipalPaid = (payments ?? []).reduce((sum, p) => sum + Number(p.principal_portion || 0), 0);
    }

    const totalPrincipalIssued = (loans ?? []).reduce((sum, l) => sum + Number(l.principal_amount || 0), 0);
    currentLoanAmount = Math.max(0, totalPrincipalIssued - totalPrincipalPaid);
  }

  // ---------------------------------------------------------
  // REFERRAL EARNINGS
  // ---------------------------------------------------------
  const { data: referredLoans } = await supabase.from("loans").select("id").eq("referred_by", user.id);
  const referredLoanIds = (referredLoans ?? []).map((l) => l.id);

  if (referredLoanIds.length > 0) {
    const [{ data: intPayments }, { data: standardPayments }] = await Promise.all([
      supabase.from("loan_interest_payments").select("referral_amount").in("loan_id", referredLoanIds),
      supabase.from("loan_payments").select("referral_portion, referral_amount").in("loan_id", referredLoanIds).eq("status", "approved"),
    ]);

    const sum1 = (intPayments ?? []).reduce((sum, r) => sum + Number(r.referral_amount || 0), 0);
    const sum2 = (standardPayments ?? []).reduce((sum, r) => sum + Number(r.referral_portion || r.referral_amount || 0), 0);
    referralBonusEarned = sum1 + sum2;
  }

  // ---------------------------------------------------------
  // RENDER THE CLIENT COMPONENT
  // ---------------------------------------------------------
  return (
    <DashboardClient
      user={user}
      profile={profile}
      accounts={accounts ?? []}
      unreadCount={unreadCount ?? 0}
      totalContribution={totalContribution}
      interestEarned={interestEarned}
      interestPerAccountShare={interestPerAccountShare}
      currentLoanAmount={currentLoanAmount}
      referralBonusEarned={referralBonusEarned}
    />
  );
}