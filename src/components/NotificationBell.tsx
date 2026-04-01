import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tbl_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications((data as Notification[]) || []);
  };

  useEffect(() => {
    fetchNotifications();
    if (!user) return;
    const channel = supabase
      .channel("notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "tbl_notifications", filter: `user_id=eq.${user.id}` }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markRead = async (id: string) => {
    await supabase.from("tbl_notifications").update({ is_read: true } as any).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const handleClick = (n: Notification) => {
    markRead(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-outflow text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border px-4 py-3">
          <h4 className="font-heading text-sm font-semibold">Notifications</h4>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${!n.is_read ? "bg-primary/5" : ""}`}
              >
                <p className={`text-sm font-medium ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
