import React, { useState } from "react";
import { useCollectionRealtime } from "@/lib/firestore-hooks";
import { Membership } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createPendingInvite, sendOrganizationInvitation } from "@/lib/services";
import { useOrganization, useUser } from "@clerk/clerk-react";
import { where } from "firebase/firestore";
import { Search, Plus } from "lucide-react";
import { toast } from "sonner";

export default function OrgAgents() {
  const { user } = useUser();
  const { organization } = useOrganization();
  const { data: members, loading } = useCollectionRealtime<Membership>("organizationMembers", [
    where("role", "==", "AGENT")
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [assignedArea, setAssignedArea] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const agents = members.filter((u) =>
    (((u?.fullName || u?.name || "").toLowerCase().includes((searchTerm || "").toLowerCase())) ||
     (u?.phone || "").includes(searchTerm || "") ||
     (u?.email || "").toLowerCase().includes((searchTerm || "").toLowerCase()))
  );

  const statusClass = (status?: string) => {
    if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (status === "INVITED") return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-slate-50 text-slate-600 border-slate-100";
  };

  const handleInviteAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) {
      toast.error("No active organization selected. Refresh and try again.");
      return;
    }
    if (!user?.id) {
      toast.error("Unable to send invitation without a signed-in owner.");
      return;
    }
    if (!email.trim()) {
      toast.error("Email address is required.");
      return;
    }
    
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
        assignedArea: assignedArea.trim(),
      });

      toast.success(result.message);
      setIsInviteOpen(false);
      setEmail(""); 
      setAssignedArea("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send agent invitation";
      console.error("handleInviteAgent error:", errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manage Agents</h2>
          <p className="text-slate-500">View and add collection agents.</p>
        </div>
        
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger render={
            <Button className="shrink-0"><Plus className="w-4 h-4 mr-2"/> Invite Agent</Button>
          } />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Pigmy Collector</DialogTitle>
              <p className="text-sm text-slate-500 mt-2">
                Send an organization invitation to a pigmy collector.
              </p>
            </DialogHeader>
            <form onSubmit={handleInviteAgent} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="collector@example.com"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area">Assigned Area (Optional)</Label>
                <Input 
                  id="area" 
                  placeholder="e.g., Northeast District"
                  value={assignedArea} 
                  onChange={e => setAssignedArea(e.target.value)} 
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Invitation"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input 
              placeholder="Search agents by name or phone..." 
              className="pl-10"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Assigned Area</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : agents.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">No agents found.</TableCell></TableRow>
              ) : (
                agents.map(agent => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.fullName || agent.name || "Unnamed Agent"}</TableCell>
                    <TableCell>{agent.phone || "N/A"}</TableCell>
                    <TableCell>{agent.email || "N/A"}</TableCell>
                    <TableCell>{agent.assignedArea || "Unassigned"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${statusClass(agent.status)}`}>
                        {agent.status || "INVITED"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
