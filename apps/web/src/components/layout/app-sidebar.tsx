import { useLocation, useNavigate } from "react-router"
import { signOut } from "@/lib/auth-client"
import type { AppUser } from "@/lib/types"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  DollarSign,
  Warehouse,
  UtensilsCrossed,
  Settings,
  Shield,
  LogOut,
  ChevronUp,
  User,
  Truck,
  ClipboardList,
  ClipboardCheck,
  Scale,
} from "lucide-react"

interface AppSidebarProps {
  user: AppUser
}

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    module: null,
  },
  {
    title: "POS Terminal",
    url: "/dashboard/pos",
    icon: ShoppingCart,
    module: "orders",
  },
  {
    title: "Orders",
    url: "/dashboard/orders",
    icon: ClipboardList,
    module: "orders",
  },
]

const restaurantNavItems = [
  {
    title: "Tables",
    url: "/dashboard/tables",
    icon: UtensilsCrossed,
    module: "orders",
  },
  {
    title: "Kitchen Display",
    url: "/dashboard/kitchen",
    icon: UtensilsCrossed,
    module: "orders",
  },
  {
    title: "Production",
    url: "/dashboard/production",
    icon: ClipboardCheck,
    module: null,
    roles: ["executive", "admin", "checkoff"],
  },
]

const inventoryNavItems = [
  {
    title: "Products",
    url: "/dashboard/products",
    icon: Package,
    module: "products",
  },
  {
    title: "Inventory",
    url: "/dashboard/inventory",
    icon: Warehouse,
    module: "inventory",
  },
  {
    title: "Purchase Orders",
    url: "/dashboard/purchasing",
    icon: Truck,
    module: "inventory",
  },
]

const managementNavItems = [
  {
    title: "Cash Control",
    url: "/dashboard/cash",
    icon: DollarSign,
    module: "shifts",
  },
  {
    title: "Reports",
    url: "/dashboard/reports",
    icon: BarChart3,
    module: "reports",
  },
  {
    title: "Reconciliation",
    url: "/dashboard/reconciliation",
    icon: Scale,
    module: "reports",
    roles: ["executive", "admin"],
  },
  {
    title: "Audit Log",
    url: "/dashboard/audit",
    icon: Shield,
    module: "audit",
  },
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: Settings,
    module: "settings",
  },
]

function canSeeItem(
  user: AppUser,
  item: { module: string | null; roles?: string[] }
): boolean {
  // If role-restricted, check user role
  if (item.roles && item.roles.length > 0) {
    if (!item.roles.includes(user.role)) return false
  }
  // If module-restricted, check permissions
  if (item.module) {
    const perms = user.permissions[item.module]
    return Array.isArray(perms) && perms.length > 0
  }
  return true
}

export function AppSidebar({ user }: AppSidebarProps) {
  const location = useLocation()
  const pathname = location.pathname
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate("/login")
  }

  function renderNavGroup(
    label: string,
    items: typeof mainNavItems
  ) {
    const filtered = items.filter((item) =>
      canSeeItem(user, item)
    )
    if (filtered.length === 0) return null

    return (
      <SidebarGroup>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {filtered.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.url}
                  tooltip={item.title}
                >
                  <a href={item.url}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="h-auto py-2">
              <a href="/dashboard">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
                  <img
                    src="/images/bettencourts-logo.png"
                    alt="Bettencourt's logo"
                    width={40}
                    height={40}
                    className="object-contain"
                  />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">{"Bettencourt's"}</span>
                  <span className="text-xs text-sidebar-muted-foreground">
                    Food Inc.
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {renderNavGroup("Main", mainNavItems)}
        {renderNavGroup("Restaurant", restaurantNavItems)}
        {renderNavGroup("Inventory", inventoryNavItems)}
        {renderNavGroup("Management", managementNavItems)}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-12">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs capitalize text-sidebar-muted-foreground">
                      {user.role}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
