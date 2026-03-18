self.addEventListener("push", function (event) {
  if (event.data) {
    let data;
    try {
      data = event.data.json();
    } catch {
      data = {
        title: "Vexa",
        body: event.data.text(),
      };
    }

    const options = {
      body: data.body,
      icon: data.icon || "/icon.png",
      badge: "/badge.png",
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: "2",
        targetPath: data.targetPath || "/",
      },
    };
    event.waitUntil(self.registration.showNotification(data.title, options));
  }
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const targetPath = event.notification?.data?.targetPath || "/";
  event.waitUntil(clients.openWindow(self.location.origin + targetPath));
});
