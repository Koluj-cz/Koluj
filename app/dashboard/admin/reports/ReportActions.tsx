"use client";
import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
export default function ReportActions() { const [busy,setBusy]=useState(false); const router=useRouter(); async function run(){setBusy(true);try{const response=await fetch("/api/admin/reports/run",{method:"POST"});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error||"Report se nepodařilo vytvořit");toast.success("Report byl vytvořen a odeslán");router.refresh();}catch(error){toast.error(error instanceof Error?error.message:"Akce selhala");}finally{setBusy(false)}} return <button onClick={()=>void run()} disabled={busy} className="rounded-2xl bg-violet-600 px-5 py-3 font-black text-white disabled:opacity-50">{busy?"Vytvářím…":"Vytvořit report nyní"}</button> }
