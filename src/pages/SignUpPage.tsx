import { SignUp } from "@clerk/clerk-react";
import AuthLayout from "@/components/AuthLayout";

export default function SignUpPage() {
  return (
    <AuthLayout
      title="Create Your Account"
      subtitle="Register as an organization owner. You'll set up your workspace after verifying your email."
      features={["Email + OTP verification", "Secure Clerk authentication", "Organization workspace setup"]}
      ctaText="Already have an account?"
      ctaLink="/workspace-selection"
      ctaRoleLabel="Sign In"
    >
      <div className="space-y-6">
        <SignUp
          routing="path"
          path="/sign-up"
          signInUrl="/workspace-selection"
          forceRedirectUrl="/auth/callback"
        />
      </div>
    </AuthLayout>
  );
}
