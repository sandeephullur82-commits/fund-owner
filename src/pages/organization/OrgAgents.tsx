import React, { useState } from "react";
import { useCollectionRealtime, useDocumentRealtime } from "@/lib/firestore-hooks";
import { Membership } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { sendOrganizationInvitation } from "@/lib/services";
import { useOrganization, useUser } from "@clerk/clerk-react";
import { where } from "firebase/firestore";
import { Search, Plus, AlertTriangle, ArrowRight, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";

export default function OrgAgents() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const { data: members, loading } = useCollectionRealtime<Membership>("organizationMembers", [
    where("role", "==", "AGENT")
  ]);
  const { data: orgDoc } = useDocumentRealtime<any>("organizations", organization?.id);

  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [assignedArea, setAssignedArea] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const collectors = members.filter((u) =>
    (((u?.fullName || u?.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())) ||
     (u?.phone || "").includes(searchTerm || "") ||
     (u?.email || "").toLowerCase().includes((searchTerm || "").toLowerCase()))
  );

  const maxCollectors = orgDoc?.limits?.maxAgents || 1;
  const activeCollectors = members.filter((a: any) => a.status === "ACTIVE").length || 0;
  const invitedCollectors = members.filter((a: any) => a.status === "INVITED" || a.status === "PENDING").length || 0;
  const atLimit = activeCollectors >= maxCollectors;

  const statusConfig: Record<string, { label: string; className: string }> = {
    ACTIVE:    { label: "Active",    className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
    INVITED:   { label: "Invited",   className: "bg-amber-50 text-amber-700 border-amber-100" },
    PENDING:   { label: "Pending",   className: "bg-sky-50 text-sky-700 border-sky-100" },
    SUSPENDED: { label: "Suspended", className: "bg-red-50 text-red-700 border-red-100" },
  };

  const getStatus = (status?: string) => {
    const key = (status || "INVITED").toUpperCase();
    return statusConfig[key] || { label: key, className: "bg-slate-50 text-slate-600 border-slate-100" };
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setAssignedArea("");
    setNotes("");
  };

  const handleInviteCollector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) { toast.error("No active organization selected. Refresh and try again."); return; }
    if (!user?.id) { toast.error("Unable to send invitation without a signed-in owner."); return; }
    if (!email.trim()) { toast.error("Email address is required."); return; }
    if (atLimit) { toast.error(`You've reached the limit of ${maxCollectors} collectors for your plan. Please upgrade.`); return; }

    setIsSubmitting(true);
    try {
      const invitedByEmail = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "";
      const result = await sendOrganizationInvitation({
        organization,
        organizationId: organization.id,
        email: email.trim().toLowerCase(),
        role: "pigmy_collector",
        clerkRole: "org:pigmy_collector",
        invitedBy: user.id,
        invitedByEmail,
        fullName: fullName.trim(),
        phone: phone.trim(),
        notes: notes.trim(),
        assignedArea: assignedArea.trim(),
      });
      toast.success(result.message);
      setIsInviteOpen(false);
      resetForm();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to send collector invitation";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manage Collectors</h2>
          <p className="text-slate-500">
            View and add pigmy collectors.
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-1">
              <UserCheck className="w-3 h-3" />
              Active: {activeCollectors}/{maxCollectors}
            </span>
            {invitedCollectors > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                <Clock className="w-3 h-3" />
                Invited: {invitedCollectors}
              </span>
            )}
          </div>
        </div>

        {atLimit ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 font-medium shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Collector limit reached</span>
          </div>
        ) : (
          <Dialog open={isInviteOpen} onOpenChange={(open) => { setIsInviteOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger render={
              <Button className="shrink-0"><Plus className="w-4 h-4 mr-2" /> Add Collector</Button>
            } />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite Pigmy Collector</DialogTitle>
                <p className="text-sm text-slate-500 mt-1">Send an organization invitation to a new collector.</p>
              </DialogHeader>
              <form onSubmit={handleInviteCollector} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="col-name">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="col-name"
                    placeholder="e.g., Ravi Kumar"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="col-email">Email Address <span className="text-red-500">*</span></Label>
                  <Input
                    id="col-email"
                    type="email"
                    placeholder="collector@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="col-phone">Phone Number</Label>
                  <Input
                    id="col-phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="col-area">Assigned Area</Label>
                  <Input
                    id="col-area"
                    placeholder="e.g., Northeast District"
                    value={assignedArea}
                    onChange={e => setAssignedArea(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="col-notes">Notes <span className="text-slate-400 text-xs font-normal">(optional)</span></Label>
                  <Input
                    id="col-notes"
                    placeholder="Any additional notes..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Sending Invitation…" : "Send Invitation"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {atLimit && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">You've reached your collector limit ({activeCollectors}/{maxCollectors})</p>
            <p className="text-xs text-amber-600 mt-0.5">Upgrade your plan to add more pigmy collectors.</p>
          </div>
          <button
            onClick={() => {}}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-bold shrink-0 transition-all"
          >
            Upgrade <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input placeholder="Search collectors by name, email or phone..." className="pl-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Collector</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Assigned Area</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading…</TableCell></TableRow>
                ) : collectors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <p className="text-slate-500 text-sm font-medium">No collectors yet.</p>
                      <p className="text-slate-400 text-xs mt-1">Click "Add Collector" to invite your first pigmy collector.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  collectors.map(collector => {
                    const s = getStatus((collector as any).status);
                    return (
                      <TableRow key={collector.id}>
                        <TableCell className="font-medium">{collector.fullName || (collector as any).name || <span className="text-slate-400 italic">Pending setup</span>}</TableCell>
                        <TableCell>{collector.phone || <span className="text-slate-400">—</span>}</TableCell>
                        <TableCell>{collector.email || <span className="text-slate-400">—</span>}</TableCell>
                        <TableCell>{(collector as any).assignedArea || <span className="text-slate-400">Unassigned</span>}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${s.className}`}>
                            {s.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
