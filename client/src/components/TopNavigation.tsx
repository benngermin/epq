import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut, BookOpen, Shield, Settings, ChevronDown, User } from "lucide-react";
import institutesLogo from "@assets/the-institutes-logo_1750194170496.png";

export default function TopNavigation() {
  const { user, logoutMutation } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/login");
      },
    });
  };

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <img 
            src={institutesLogo} 
            alt="The Institutes" 
            className="h-8 w-auto"
          />
          <div className="flex items-center space-x-1">
            <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <span className="text-xl font-semibold text-gray-900 dark:text-white">
              CPCU 500 Practice
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/dashboard")}
            className="flex items-center space-x-2"
          >
            <BookOpen className="h-4 w-4" />
            <span>Dashboard</span>
          </Button>

          {user?.isAdmin && (
            <Button
              variant="ghost"
              onClick={() => setLocation("/admin")}
              className="flex items-center space-x-2"
            >
              <Shield className="h-4 w-4" />
              <span>Admin</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2">
                <User className="h-4 w-4" />
                <span>{user?.name}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setLocation("/dashboard")}>
                <BookOpen className="h-4 w-4 mr-2" />
                Dashboard
              </DropdownMenuItem>
              {user?.isAdmin && (
                <DropdownMenuItem onClick={() => setLocation("/admin")}>
                  <Shield className="h-4 w-4 mr-2" />
                  Admin Panel
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setLocation("/settings")}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}