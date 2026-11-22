import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Home,
  LogOut,
  Moon,
  Search,
  Settings,
  Sun,
  User,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useProfile, useUnreadNotificationCount } from "../hooks/useQueries";
import { getInitials } from "../utils/formatting";

const NAV_ITEMS = [
  { label: "Home", icon: Home, to: "/" },
  { label: "Search", icon: Search, to: "/search" },
  { label: "Notifications", icon: Bell, to: "/notifications" },
  { label: "Communities", icon: Users, to: "/communities" },
  { label: "Settings", icon: Settings, to: "/settings" },
] as const;

function isNavActive(itemTo: string, currentPath: string): boolean {
  if (itemTo === "/") return currentPath === "/";
  if (itemTo === "/search")
    return (
      currentPath.startsWith("/search") || currentPath.startsWith("/hashtag/")
    );
  if (itemTo === "/communities")
    return (
      currentPath.startsWith("/communities") ||
      currentPath.startsWith("/community/")
    );
  return currentPath.startsWith(itemTo);
}

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const queryClient = useQueryClient();
  const { clear } = useInternetIdentity();

  const handleLogout = () => {
    queryClient.clear();
    clear();
  };
  const { data: profile, isError: isProfileError } = useProfile();
  const { data: unreadCount } = useUnreadNotificationCount();
  const { theme, setTheme } = useTheme();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const initials = profile?.displayName
    ? getInitials(profile.displayName)
    : "?";
  const profilePictureUrl = profile?.profilePictureHash
    ? profile.profilePictureHash.getDirectURL()
    : null;

  return (
    <div className="flex h-full flex-col font-mono">
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <Link
          to="/"
          className="flex items-center transition-opacity hover:opacity-70"
          onClick={onNavigate}
        >
          <img
            src="/brand/hyvmind_logo_light.png"
            alt="Hyvmind"
            className="h-6 w-auto dark:hidden"
          />
          <img
            src="/brand/hyvmind_logo_dark.png"
            alt="Hyvmind"
            className="hidden h-6 w-auto dark:block"
          />
        </Link>
      </div>

      <nav className="flex-1 py-2">
        <ul>
          {NAV_ITEMS.map((item) => {
            const active = isNavActive(item.to, currentPath);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors",
                    "border-l-2",
                    active
                      ? "border-l-primary bg-accent text-foreground"
                      : "border-l-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                  onClick={onNavigate}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1">{item.label}</span>
                  {item.to === "/notifications" &&
                    !!unreadCount &&
                    unreadCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center bg-primary px-1 text-[10px] tabular-nums text-primary-foreground">
                        {unreadCount > 99 ? "99+" : unreadCount.toString()}
                      </span>
                    )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border">
        {isProfileError ? (
          <div className="px-4 py-3 text-[11px] text-destructive">
            Failed to load profile
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {profilePictureUrl && (
                    <AvatarImage
                      src={profilePictureUrl}
                      alt={profile?.displayName ?? ""}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-muted text-[10px] text-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-[12px] text-foreground">
                    {profile?.displayName}
                  </span>
                  <span className="truncate text-[10px] tracking-[0.04em] text-muted-foreground">
                    @{profile?.username}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="start"
              className="w-(--radix-dropdown-menu-trigger-width) min-w-[190px] font-mono text-[12px]"
            >
              <DropdownMenuItem asChild>
                <Link
                  to="/$username"
                  params={{ username: profile?.username ?? "" }}
                  onClick={onNavigate}
                >
                  <User className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-3.5 w-3.5 dark:hidden" strokeWidth={1.5} />
                <Moon
                  className="hidden h-3.5 w-3.5 dark:block"
                  strokeWidth={1.5}
                />
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
