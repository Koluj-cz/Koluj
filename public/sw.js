self.addEventListener("push", function (event) {
  if (!event.data) return;

  const data = event.data.json();

  const title = data.title || "Koluj";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: data.url || "/dashboard/notifications",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(clients.openWindow(url));
});