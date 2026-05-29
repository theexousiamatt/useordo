import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { OrdoSidebar } from "@/components/OrdoSidebar";
import { WorkspaceSearch } from "@/components/client/WorkspaceSearch";
import { NotificationButton } from "@/components/client/NotificationButton";
import { UserProfileMenu } from "@/components/client/UserProfileMenu";

export function OrdoTopBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {/* Mobile drawer trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Open navigation"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-panel lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] border-none bg-transparent p-3">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <OrdoSidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden md:block">
            <WorkspaceSearch />
          </div>
          <NotificationButton />
          <UserProfileMenu />
        </div>
      </div>

      {/* Mobile search */}
      <div className="md:hidden">
        <WorkspaceSearch />
      </div>
    </header>
  );
}
