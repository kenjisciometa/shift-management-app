// Service Worker for Push Notifications

self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    console.log("Push event but no data");
    return;
  }

  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: "Notification",
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192x192.png",
    badge: data.badge || "/badge-72x72.png",
    tag: data.tag || "default",
    data: data.data || {},
    actions: data.actions || [],
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Notification", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = "/dashboard";

  // Route based on notification type
  if (data.type) {
    switch (data.type) {
      case "shift":
        url = "/schedule";
        break;
      case "time_clock":
        url = "/time-clock";
        break;
      case "chat":
        url = data.roomId ? `/chat?room=${data.roomId}` : "/chat";
        break;
      case "task":
        url = "/tasks";
        break;
      case "pto":
        url = "/pto";
        break;
      case "approval":
        url = data.approvalType === "timesheet" ? "/timesheets" : "/pto";
        break;
      default:
        url = data.url || "/dashboard";
    }
  }

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab with the target URL
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
