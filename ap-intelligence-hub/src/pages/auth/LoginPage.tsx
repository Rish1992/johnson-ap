import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_CONFIG } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Eye, EyeOff, FileText, Zap, Shield, BarChart3, Loader2 } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password);

    const user = useAuthStore.getState().user;
    if (user) {
      navigate(ROLE_CONFIG[user.role].homePath);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[55%] relative bg-gradient-to-br from-[#1A1A1A] via-[#242424] to-[#1A1A1A] flex-col justify-between p-12 text-white overflow-hidden">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: '#DC2626', animationDuration: '4s' }} />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: '#F87171', animationDuration: '6s', animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl animate-pulse" style={{ backgroundColor: '#DC2626', animationDuration: '5s', animationDelay: '2s' }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/50 via-transparent to-[#1A1A1A]/30" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-10 w-10 text-red-400" />
            <span className="text-2xl font-bold text-white">InvoiceIQ</span>
          </div>
          <p className="text-red-200 text-lg">Intelligent Accounts Payable Platform</p>
        </div>

        <div className="relative z-10 space-y-8">
          <h1 className="text-4xl font-bold leading-tight">
            Streamline your invoice
            <br />
            processing with AI
          </h1>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
                <Zap className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">AI-Powered Extraction</h3>
                <p className="text-red-200 text-sm">
                  Automatically extract and validate invoice data with high accuracy
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-500/15 rounded-lg shrink-0">
                <Shield className="h-6 w-6 text-red-300" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Smart Approval Workflows</h3>
                <p className="text-red-200 text-sm">
                  Configurable multi-level approval chains with real-time tracking
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="p-2 bg-red-400/20 rounded-lg shrink-0">
                <BarChart3 className="h-6 w-6 text-red-300" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Real-Time Analytics</h3>
                <p className="text-red-200 text-sm">
                  Monitor processing times, accuracy, and SLA compliance
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-neutral-500 text-sm">
          InvoiceIQ v1.0 &middot; Confidential
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-none lg:shadow-xl lg:border">
          <CardContent className="p-10">
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-2 mb-3 lg:hidden">
                <FileText className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold">InvoiceIQ</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome Back</h2>
              <p className="text-muted-foreground mt-2">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-11 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="pr-10 h-11 text-sm transition-shadow focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full h-11 text-sm font-semibold mt-2 bg-red-600 hover:bg-red-700 text-white" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-8 p-4 bg-accent/50 rounded-xl">
              <p className="text-xs text-muted-foreground font-semibold mb-2">Demo Accounts:</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><span className="font-medium">Agent:</span> sarah.chen@company.com</p>
                <p><span className="font-medium">Approver:</span> emma.thompson@company.com</p>
                <p><span className="font-medium">Admin:</span> alex.kumar@company.com</p>
                <p className="mt-1"><span className="font-medium">Password:</span> password123</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
