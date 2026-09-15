(async function () {
  var host = document.getElementById("spa-content-loader");
  var names = ["devices", "topology", "power", "blueprint", "design", "legend"];
  var fragments;
  try {
    fragments = await Promise.all(names.map(async function (name) {
      var response = await fetch("sections/" + name + ".html");
      if (!response.ok) throw new Error("Unable to load " + name + " (HTTP " + response.status + ")");
      return response.text();
    }));
  } catch (error) {
    console.error(error);
    if (host) host.innerHTML = '<p role="alert">Unable to load the specification sections. Serve this directory over HTTP and reload.</p>';
    return;
  }

  var legend = fragments.pop();
  host.insertAdjacentHTML("beforebegin", fragments.join("\n"));
  host.remove();
  ["legend-source", "legend-topo"].forEach(function (id) {
    var target = document.getElementById(id);
    if (target) target.innerHTML = legend;
  });
(function () {
      var canvas = document.getElementById("topo-canvas");
      if (!canvas) return;

      var GAP_X = 32;
      var GAP_Y = 10;
      var GAP_MINI = 3;
      var PORT_GAP_MINI = 3;
      var GAP_TB = 36;
      var GAP_CORE = 20;
      var GAP_CORE_DAC = 28;
      var PAD = 16;
      var SLOT_MIN = 28;
      var SLOT_IDLE_MINI = 26;
      var BOX_PAD = 10;
      var BOX_PAD_MINI = 4;

      function poe(kind) {
        if (!kind) return "";
        var href = kind === "wan" ? "#udc-wan"
          : kind === "plus" ? "#udc-poe-plus"
          : kind === "pp" ? "#udc-poe-plusplus"
          : kind === "ppp" ? "#udc-poe-plusplusplus"
          : "#udc-poe";
        return '<svg class="udc-poe" aria-hidden="true"><use href="' + href + '"/></svg>';
      }

      function portHTML(p) {
        var cls = "udc-port " + p.c + (p.idle ? " idle" : "") + (p.dash ? " dash" : "") + (p.loose ? " loose" : "");
        var inner = p.c === "other"
          ? p.t
          : poe(p.poe) + (p.t ? '<span class="udc-sfp-txt">' + p.t + "</span>" : "");
        var port = '<span class="' + cls + '" data-port="' + p.id + '" title="' + p.title + '">' + inner + "</span>";
        return p.count
          ? '<span class="topo-counted-port">' + port + '<span class="topo-port-count">×' + p.count + "</span></span>"
          : port;
      }

      function portsHTML(list) {
        return (list || []).map(portHTML).join("");
      }

      function P(id, c, extra) {
        var p = { id: id, c: c, title: extra.title };
        if (extra.poe) p.poe = extra.poe;
        if (extra.t) p.t = extra.t;
        if (extra.idle) p.idle = true;
        if (extra.dash) p.dash = true;
        if (extra.loose) p.loose = true;
        if (extra.count) p.count = extra.count;
        if (extra.child) p.child = extra.child;
        if (extra.side) p.side = extra.side;
        return p;
      }

      function idleMany(n, prefix, c, extra) {
        var out = [];
        for (var i = 1; i <= n; i++) out.push(P(prefix + i, c, extra));
        return out;
      }

      function downSlots(n, side) {
        var slots = [];
        (n.down || []).forEach(function (p) {
          var portSide = p.side || "right";
          if (side && portSide !== side) return;
          var last = slots[slots.length - 1];
          if (p.child && last && last.child === p.child && last.side === portSide) last.ports.push(p);
          else slots.push({ ports: [p], child: p.child || null, side: portSide });
        });
        return slots;
      }

      function DoorHubSubtrees(branches) {
        return { kind: "door-hub-subtrees", branches: branches };
      }

      var UI = "https://store.ui.com/us/en/products/";
      var nodes = [
        { id: "nah", ltr: true, name: "TELUS Network Access Hub", loc: "Rack Cabinet", href: "https://www.telus.com/en/bc/internet", info: "XGS-PON ends here. 10G RJ45 WAN out.",
          up: [P("nah-pon", "other", { t: "F", title: "XGS-PON fiber in" })],
          down: idleMany(4, "nah-1g", "gbe1", { title: "1G RJ45 unused", idle: true }).concat([
            P("nah-10g", "gbe10", { poe: "wan", title: "10G RJ45 WAN out · Cat6A to UDM CM adapter", child: "udm" })
          ]) },
        { id: "udm", vlan: "management", ltr: true, name: "UDM-Pro-Max", loc: "Rack Cabinet", href: UI + "udm-pro-max", info: "NAH Cat6A terminates at the RJ45 face of a UACC-CM-RJ45-MG inserted in UDM WAN SFP+. LAN SFP+ connects directly to Pro XG by one DAC.",
          embed: [
            { name: "UACC-CM-RJ45-MG · RJ45 ↔ SFP+", href: UI + "uacc-cm-rj45-mg" }
          ],
          up: [
            P("udm-wan", "sfp", { poe: "wan", t: "SFP+", title: "WAN SFP+ via UACC-CM-RJ45-MG" }),
            P("udm-wan25", "gbe2p5", { poe: "wan", title: "WAN 2.5G RJ45 unused", idle: true })
          ],
          down: idleMany(8, "udm-lan", "gbe1", { title: "LAN 1G unused", idle: true }).concat([
            P("udm-lan-sfp", "sfp", { t: "SFP+", title: "LAN SFP+ → UACC-DAC-SFP10", child: "xg" })
          ]) },
        { id: "xg", vlan: "management", name: "USW-Pro-XG-24-PoE", loc: "Rack Cabinet", href: UI + "usw-pro-xg-24-poe", info: "2×SFP28 + 8×2.5G PoE+++ + 16×10G PoE+++. Unused ports hollow.",
          poeBar: { modes: [
            { label: "PoE Power Used · Garage Flex on AC", used: 463.5, cap: 720 },
            { label: "PoE Power Used · Garage Flex on PoE+++", used: 532.9, cap: 720 }
          ] },
          up: [
            P("xg-sfp", "sfp", { t: "SFP28", title: "SFP28 ← UACC-DAC-SFP10 at 10G" }),
            P("xg-sfp2", "sfp", { t: "SFP28", title: "SFP28 unused", idle: true })
          ],
          down: [
            P("xg-ha", "gbe2p5", { poe: "ppp", title: "2.5G PoE+++ → HA", child: "ha", side: "left" }),
            P("xg-wallpanels", "gbe2p5", { poe: "ppp", title: "3× 2.5G PoE+++ ports → Wallpanels at 1G PoE++", count: 3, child: "group-wallpanels", side: "left" }),
            P("xg-front", "gbe2p5", { poe: "ppp", title: "2.5G PoE+++ → Front Mini", child: "group-main-doors", side: "left" }),
            P("xg-mud", "gbe2p5", { poe: "ppp", title: "2.5G PoE+++ → Mud Mini", child: "group-main-doors", side: "left" }),
            P("xg-din", "gbe2p5", { poe: "ppp", title: "2.5G PoE+++ → Dining Mini", child: "group-main-doors", side: "left" }),
            P("xg-bsmt", "gbe2p5", { poe: "ppp", title: "2.5G PoE+++ → Basement Mini", child: "group-main-doors", side: "left" }),
            P("xg-aps", "gbe10", { poe: "ppp", title: "3× 10G PoE+++ → U7-Pro at 2.5G", count: 3, child: "group-aps" }),
            P("xg-view", "gbe10", { poe: "ppp", title: "10G PoE+++ → Viewport at 1G", child: "view" }),
            P("xg-nas", "gbe10", { poe: "ppp", title: "10G PoE+++ → NAS LACP", child: "nas" }),
            P("xg-nas2", "gbe10", { poe: "ppp", title: "10G PoE+++ → NAS LACP", child: "nas" }),
            P("xg-room-backup", "gbe10", { poe: "ppp", title: "5× cabinet-end backup C6A · not connected to XG", loose: true, count: 5, child: "group-room-drops" }),
            P("xg-room-live", "gbe10", { poe: "ppp", title: "5× active XG Room Drop ports", count: 5, child: "group-room-drops" }),
            P("xg-media-backup", "gbe10", { poe: "ppp", title: "Media Room backup C6A · cabinet end not connected to XG", loose: true, child: "drop-media" }),
            P("xg-media-live", "gbe10", { poe: "ppp", title: "10G PoE+++ → active Media Room C6A", child: "drop-media" }),
            P("xg-gar-backup", "gbe10", { poe: "ppp", title: "Cabinet-end Garage backup C6A · not connected to XG", loose: true, child: "drop-gar" }),
            P("xg-gar", "gbe10", { poe: "ppp", title: "10G PoE+++ → active Garage C6A", child: "drop-gar" }),
            P("xg-spare-10g-1", "gbe10", { poe: "ppp", title: "10G PoE+++ spare", idle: true }),
            P("xg-spare-10g-2", "gbe10", { poe: "ppp", title: "10G PoE+++ spare", idle: true }),
            P("xg-spare-10g-3", "gbe10", { poe: "ppp", title: "10G PoE+++ spare", idle: true })
          ] },
        { id: "nas", vlan: "servers", inbound: "nas-10g", name: "Synology FS2500", loc: "Rack Cabinet", href: "https://www.synology.com/en-us/products/FS2500", info: "1U all-flash · 12×2.5\" SATA SSD. 2×10G LACP to Pro XG; 2×1G unused. 2×USB 3.2 + Console unused.",
          up: [
            P("nas-1g1", "gbe1", { title: "1G unused", idle: true }),
            P("nas-1g2", "gbe1", { title: "1G unused", idle: true }),
            P("nas-10g", "gbe10", { title: "10G LACP" }),
            P("nas-10g2", "gbe10", { title: "10G LACP" })
          ],
          down: [
            P("nas-usb1", "other", { t: "USB-3", title: "USB 3.2 unused", idle: true }),
            P("nas-usb2", "other", { t: "USB-3", title: "USB 3.2 unused", idle: true }),
            P("nas-con", "other", { t: "COM", title: "Console unused", idle: true })
          ] },
        { id: "ha", vlan: "servers", ltr: true, name: "ameriDroid PoE Mini PC for Home Assistant", loc: "Rack Cabinet", href: "https://ameridroid.com/products/poe-mini-pc-for-home-assistant", info: "4×2.5G Intel I225/I226: one PoE++ IN plus three unused NICs are shown on the upstream side. Two nested ZBT-2 radios: Zigbee on USB-C, Thread on USB-3 via USB-A/C adapter.",
          embed: [
            { name: "Connect ZBT-2 · Zigbee", href: "https://www.home-assistant.io/connect/zbt-2/" },
            { name: "Connect ZBT-2 · Thread", href: "https://www.home-assistant.io/connect/zbt-2/" }
          ],
          poeBar: { used: 30, cap: 90 },
          up: [
            P("ha-up", "gbe2p5", { poe: "pp", title: "2.5G PoE++ IN" })
          ].concat(idleMany(3, "ha-lan", "gbe2p5", { title: "2.5G LAN unused", idle: true })),
          down: [
            P("ha-hdmi", "other", { t: "HDMI", title: "HDMI 2.0 unused", idle: true }),
            P("ha-dp", "other", { t: "DP", title: "DisplayPort 1.4 unused", idle: true }),
            P("ha-usb2a", "other", { t: "USB-2", title: "USB 2.0 unused", idle: true }),
            P("ha-usb2b", "other", { t: "USB-2", title: "USB 2.0 unused", idle: true }),
            P("ha-usb2c", "other", { t: "USB-2", title: "USB 2.0 unused", idle: true }),
            P("ha-usb2d", "other", { t: "USB-2", title: "USB 2.0 unused", idle: true }),
            P("ha-usb3", "other", { t: "USB-3", title: "USB 3.0 → ZBT-2 Thread via USB-A/C adapter" }),
            P("ha-usb", "other", { t: "USB-C", title: "USB-C → ZBT-2 Zigbee" }),
            P("ha-com", "other", { t: "COM", title: "RS232 unused", idle: true })
          ] },
        { id: "u7b", vlan: "management", name: "U7-Pro", loc: "Basement", href: UI + "u7-pro", info: "2.5G PoE+ from Pro XG.",
          poeBar: { used: 21, cap: 90 },
          up: [P("u7b-up", "gbe2p5", { poe: "plus", title: "2.5G PoE+" })], down: [] },
        { id: "u7m", vlan: "management", name: "U7-Pro", loc: "Main", href: UI + "u7-pro", info: "2.5G PoE+ from Pro XG.",
          poeBar: { used: 21, cap: 90 },
          up: [P("u7m-up", "gbe2p5", { poe: "plus", title: "2.5G PoE+" })], down: [] },
        { id: "u7u", vlan: "management", name: "U7-Pro", loc: "Upper", href: UI + "u7-pro", info: "2.5G PoE+ from Pro XG.",
          poeBar: { used: 21, cap: 90 },
          up: [P("u7u-up", "gbe2p5", { poe: "plus", title: "2.5G PoE+" })], down: [] },
        { id: "drop-media-bak", backup: true, name: "UACC-Keystone-Jack-C6A", loc: "Basement/Media Room", href: UI + "uacc-keystone-jack-c6a", info: "Backup C6A. Terminated at the patch panel; not patched to XG.",
          up: [P("drop-media-bak-up", "gbe10", { poe: "ppp", title: "10G backup keystone · wired to loose cabinet end" })],
          down: [P("drop-media-bak-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-media", name: "UACC-Keystone-Jack-C6A", loc: "Basement/Media Room", href: UI + "uacc-keystone-jack-c6a", info: "Active C6A home-run → non-PoE Flex 2.5G at 10G. The second run is shown above as a separate dashed backup card.",
          up: [P("drop-media-up", "gbe10", { poe: "ppp", title: "10G ← Pro XG" })],
          down: [P("drop-media-dn", "gbe10", { poe: "ppp", title: "10G PoE+++ pass-through → Flex 2.5G at PoE+", child: "media-flex" })] },
        { id: "media-flex", vlan: "management", ltr: true, name: "USW-Flex-2.5G-8", loc: "Basement/Media Room", href: "https://store.ui.com/us/en/category/switching-utility/products/usw-flex-2-5g-8", info: "Non-PoE model. 10G RJ45/SFP+ combo uplink; powered through the 10G RJ45 at PoE+. Eight 2.5G downlinks have no PoE output.",
          poeBar: { used: 14, cap: 30 },
          up: [
            P("media-flex-up", "gbe10", { poe: "plus", title: "10G RJ45 uplink · PoE+ input" }),
            P("media-flex-sfp", "sfp", { t: "SFP+", title: "SFP+ combo alternative · unused", idle: true })
          ],
          down: idleMany(8, "media-flex-lan", "gbe2p5", { title: "2.5G RJ45 · no PoE output · unused", idle: true }) },
        { id: "drop-den-bak", backup: true, name: "UACC-Keystone-Jack-C6A", loc: "Main/Den", href: UI + "uacc-keystone-jack-c6a", info: "Backup C6A. Terminated at the patch panel; not patched to XG.",
          up: [P("drop-den-bak-up", "gbe10", { poe: "ppp", title: "10G backup keystone · wired to loose cabinet end" })],
          down: [P("drop-den-bak-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-den", name: "UACC-Keystone-Jack-C6A", loc: "Main/Den", href: UI + "uacc-keystone-jack-c6a", info: "Patched C6A. 2-port plate; second jack is the backup above.",
          up: [P("drop-den-up", "gbe10", { poe: "ppp", title: "10G keystone" })],
          down: [P("drop-den-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-master-bak", backup: true, name: "UACC-Keystone-Jack-C6A", loc: "Upper/Master Bedroom", href: UI + "uacc-keystone-jack-c6a", info: "Backup C6A. Terminated at the patch panel; not patched to XG.",
          up: [P("drop-master-bak-up", "gbe10", { poe: "ppp", title: "10G backup keystone · wired to loose cabinet end" })],
          down: [P("drop-master-bak-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-master", name: "UACC-Keystone-Jack-C6A", loc: "Upper/Master Bedroom", href: UI + "uacc-keystone-jack-c6a", info: "Patched C6A. Wall has one jack; spare is the backup above.",
          up: [P("drop-master-up", "gbe10", { poe: "ppp", title: "10G keystone" })],
          down: [P("drop-master-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-br1-bak", backup: true, name: "UACC-Keystone-Jack-C6A", loc: "Upper/Bedroom 1", href: UI + "uacc-keystone-jack-c6a", info: "Backup C6A. Terminated at the patch panel; not patched to XG.",
          up: [P("drop-br1-bak-up", "gbe10", { poe: "ppp", title: "10G backup keystone · wired to loose cabinet end" })],
          down: [P("drop-br1-bak-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-br1", name: "UACC-Keystone-Jack-C6A", loc: "Upper/Bedroom 1", href: UI + "uacc-keystone-jack-c6a", info: "Patched C6A. Wall has one jack; spare is the backup above.",
          up: [P("drop-br1-up", "gbe10", { poe: "ppp", title: "10G keystone" })],
          down: [P("drop-br1-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-br2-bak", backup: true, name: "UACC-Keystone-Jack-C6A", loc: "Upper/Bedroom 2", href: UI + "uacc-keystone-jack-c6a", info: "Backup C6A. Terminated at the patch panel; not patched to XG.",
          up: [P("drop-br2-bak-up", "gbe10", { poe: "ppp", title: "10G backup keystone · wired to loose cabinet end" })],
          down: [P("drop-br2-bak-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-br2", name: "UACC-Keystone-Jack-C6A", loc: "Upper/Bedroom 2", href: UI + "uacc-keystone-jack-c6a", info: "Patched C6A. Wall has one jack; spare is the backup above.",
          up: [P("drop-br2-up", "gbe10", { poe: "ppp", title: "10G keystone" })],
          down: [P("drop-br2-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-seat-bak", backup: true, name: "UACC-Keystone-Jack-C6A", loc: "Upper/Seating Area", href: UI + "uacc-keystone-jack-c6a", info: "Backup C6A. Terminated at the patch panel; not patched to XG.",
          up: [P("drop-seat-bak-up", "gbe10", { poe: "ppp", title: "10G backup keystone · wired to loose cabinet end" })],
          down: [P("drop-seat-bak-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-seat", name: "UACC-Keystone-Jack-C6A", loc: "Upper/Seating Area", href: UI + "uacc-keystone-jack-c6a", info: "Patched C6A. Wall has one jack; spare is the backup above.",
          up: [P("drop-seat-up", "gbe10", { poe: "ppp", title: "10G keystone" })],
          down: [P("drop-seat-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },

        { id: "front-mini", vlan: "security", tb: true, name: "UA-Hub-Door-Mini", loc: "Front Door", href: UI + "ua-hub-door-mini", info: "Uplink PoE++. PoE+ → Entry and Frontyard Turret. REX, DPS, LOCK.",
          devicePower: { value: "19W" },
          poeBar: { label: "PoE Power Used", used: 33, cap: 45 },
          up: [P("front-mini-up", "gbe1", { poe: "pp", title: "1G PoE++ uplink" })],
          down: [
            P("front-mini-poe1", "gbe1", { poe: "plus", title: "PoE+ → Entry", child: "front-entry" }),
            P("front-mini-poe2", "gbe1", { poe: "plus", title: "PoE+ → Frontyard Turret", child: "cam-fy" }),
            P("front-mini-rex", "other", { t: "REX", title: "REX unused", idle: true }),
            P("front-mini-dps", "other", { t: "DPS", title: "DPS → Strike", child: "front-strike" }),
            P("front-mini-lock", "other", { t: "LOCK", title: "LOCK 12V → Strike", child: "front-strike" })
          ] },
        { id: "front-entry", vlan: "security", tb: true, hideLoc: true, name: "UVC-G6-Pro-Entry", loc: "Front Door", href: UI + "uvc-g6-pro-entry", info: "PoE+ from Front Mini.",
          poeBar: { used: 18, cap: 30 },
          up: [P("front-entry-up", "gbe1", { poe: "plus", title: "1G PoE+" })], down: [] },
        { id: "front-strike", tb: true, hideLoc: true, name: "UACC-Lock-Strike-Secure-15mm", loc: "Front Door", href: UI + "uacc-lock-strike-secure-15mm", info: "DPS + LOCK 12V from Front Mini.",
          up: [P("front-strike-dps", "other", { t: "DPS", title: "DPS" }), P("front-strike-lock", "other", { t: "LOCK", title: "LOCK 12V" })], down: [] },

        { id: "mud-mini", vlan: "security", tb: true, name: "UA-Hub-Door-Mini", loc: "Main/Mud/Back Door", href: UI + "ua-hub-door-mini", info: "Uplink PoE++. PoE → G3 and Backyard Turret. REX, DPS, LOCK.",
          devicePower: { value: "19W" },
          poeBar: { label: "PoE Power Used", used: 20, cap: 45 },
          up: [P("mud-mini-up", "gbe1", { poe: "pp", title: "1G PoE++ uplink" })],
          down: [
            P("mud-mini-poe1", "gbe1", { poe: "plus", title: "1G PoE+ port → UA-G3 at 100M PoE", child: "mud-g3" }),
            P("mud-mini-poe2", "gbe1", { poe: "plus", title: "PoE+ → Backyard Turret", child: "cam-by" }),
            P("mud-mini-rex", "other", { t: "REX", title: "REX unused", idle: true }),
            P("mud-mini-dps", "other", { t: "DPS", title: "DPS → Strike", child: "mud-strike" }),
            P("mud-mini-lock", "other", { t: "LOCK", title: "LOCK 12V → Strike", child: "mud-strike" })
          ] },
        { id: "mud-g3", vlan: "security", tb: true, hideLoc: true, name: "UA-G3", loc: "Main/Mud/Back Door", href: UI + "ua-g3", info: "PoE from Mud Mini.",
          poeBar: { used: 5, cap: 30 },
          up: [P("mud-g3-up", "fe", { poe: "poe", title: "100M PoE" })], down: [] },
        { id: "mud-strike", tb: true, hideLoc: true, name: "UACC-Lock-Strike-Secure-15mm", loc: "Main/Mud/Back Door", href: UI + "uacc-lock-strike-secure-15mm", info: "DPS + LOCK 12V from Mud Mini.",
          up: [P("mud-strike-dps", "other", { t: "DPS", title: "DPS" }), P("mud-strike-lock", "other", { t: "LOCK", title: "LOCK 12V" })], down: [] },

        { id: "din-mini", vlan: "security", tb: true, name: "UA-Hub-Door-Mini", loc: "Main/Dining/Back Door", href: UI + "ua-hub-door-mini", info: "Uplink PoE++. PoE → G3 and Walkway Bullet. REX, DPS, LOCK.",
          devicePower: { value: "19W" },
          poeBar: { label: "PoE Power Used", used: 20, cap: 45 },
          up: [P("din-mini-up", "gbe1", { poe: "pp", title: "1G PoE++ uplink" })],
          down: [
            P("din-mini-poe1", "gbe1", { poe: "plus", title: "1G PoE+ port → UA-G3 at 100M PoE", child: "din-g3" }),
            P("din-mini-poe2", "gbe1", { poe: "plus", title: "PoE+ → Walkway Bullet", child: "walk" }),
            P("din-mini-rex", "other", { t: "REX", title: "REX unused", idle: true }),
            P("din-mini-dps", "other", { t: "DPS", title: "DPS → Strike", child: "din-strike" }),
            P("din-mini-lock", "other", { t: "LOCK", title: "LOCK 12V → Strike", child: "din-strike" })
          ] },
        { id: "din-g3", vlan: "security", tb: true, hideLoc: true, name: "UA-G3", loc: "Main/Dining/Back Door", href: UI + "ua-g3", info: "PoE from Dining Mini.",
          poeBar: { used: 5, cap: 30 },
          up: [P("din-g3-up", "fe", { poe: "poe", title: "100M PoE" })], down: [] },
        { id: "din-strike", tb: true, hideLoc: true, name: "UACC-Lock-Strike-Secure-15mm", loc: "Main/Dining/Back Door", href: UI + "uacc-lock-strike-secure-15mm", info: "DPS + LOCK 12V from Dining Mini.",
          up: [P("din-strike-dps", "other", { t: "DPS", title: "DPS" }), P("din-strike-lock", "other", { t: "LOCK", title: "LOCK 12V" })], down: [] },

        { id: "bsmt-mini", vlan: "security", tb: true, name: "UA-Hub-Door-Mini", loc: "Basement/Back Door", href: UI + "ua-hub-door-mini", info: "Uplink PoE++. PoE → G3 and Courtyard Turret. REX, DPS, LOCK.",
          devicePower: { value: "19W" },
          poeBar: { label: "PoE Power Used", used: 20, cap: 45 },
          up: [P("bsmt-mini-up", "gbe1", { poe: "pp", title: "1G PoE++ uplink" })],
          down: [
            P("bsmt-mini-poe1", "gbe1", { poe: "plus", title: "1G PoE+ port → UA-G3 at 100M PoE", child: "bsmt-g3" }),
            P("bsmt-mini-poe2", "gbe1", { poe: "plus", title: "PoE+ → Courtyard Turret", child: "cam-ct" }),
            P("bsmt-mini-rex", "other", { t: "REX", title: "REX unused", idle: true }),
            P("bsmt-mini-dps", "other", { t: "DPS", title: "DPS → Strike", child: "bsmt-strike" }),
            P("bsmt-mini-lock", "other", { t: "LOCK", title: "LOCK 12V → Strike", child: "bsmt-strike" })
          ] },
        { id: "bsmt-g3", vlan: "security", tb: true, hideLoc: true, name: "UA-G3", loc: "Basement/Back Door", href: UI + "ua-g3", info: "PoE from Basement Mini.",
          poeBar: { used: 5, cap: 30 },
          up: [P("bsmt-g3-up", "fe", { poe: "poe", title: "100M PoE" })], down: [] },
        { id: "bsmt-strike", tb: true, hideLoc: true, name: "UACC-Lock-Strike-Secure-15mm", loc: "Basement/Back Door", href: UI + "uacc-lock-strike-secure-15mm", info: "DPS + LOCK 12V from Basement Mini.",
          up: [P("bsmt-strike-dps", "other", { t: "DPS", title: "DPS" }), P("bsmt-strike-lock", "other", { t: "LOCK", title: "LOCK 12V" })], down: [] },

        { id: "view", vlan: "security", name: "UP-Viewport", loc: "Main/Kitchen", href: UI + "ufp-viewport", info: "1G PoE from Pro XG.",
          poeBar: { used: 9.5, cap: 90 },
          up: [P("view-up", "gbe1", { poe: "poe", title: "1G PoE" })], down: [] },
        { id: "cam-fy", vlan: "security", tb: true, name: "UVC-G6-Pro-Turret", loc: "Frontyard/Front Eave/North East", href: UI + "uvc-g6-pro-turret", info: "1G PoE+ from Front Door Mini.",
          poeBar: { used: 15, cap: 30 },
          up: [P("cam-fy-up", "gbe1", { poe: "plus", title: "1G PoE+" })], down: [] },
        { id: "cam-by", vlan: "security", tb: true, name: "UVC-G6-Pro-Turret", loc: "Backyard/Balcony Eave/South West", href: UI + "uvc-g6-pro-turret", info: "1G PoE+ from Mud Door Mini.",
          poeBar: { used: 15, cap: 30 },
          up: [P("cam-by-up", "gbe1", { poe: "plus", title: "1G PoE+" })], down: [] },
        { id: "cam-ct", vlan: "security", tb: true, name: "UVC-G6-Pro-Turret", loc: "Courtyard/Eave", href: UI + "uvc-g6-pro-turret", info: "1G PoE+ from Basement Door Mini.",
          poeBar: { used: 15, cap: 30 },
          up: [P("cam-ct-up", "gbe1", { poe: "plus", title: "1G PoE+" })], down: [] },

        { id: "wp-b", vlan: "iot", name: "Home Assistant PoE Wallpanel", loc: "Basement Wall Mount", info: "Placeholder. 1G PoE++ uplink · 60W reserved.",
          poeBar: { used: 60, cap: 60 },
          up: [P("wp-b-up", "gbe1", { poe: "pp", title: "1G PoE++" })], down: [] },
        { id: "wp-m", vlan: "iot", name: "Home Assistant PoE Wallpanel", loc: "Main Wall Mount", info: "Placeholder. 1G PoE++ uplink · 60W reserved.",
          poeBar: { used: 60, cap: 60 },
          up: [P("wp-m-up", "gbe1", { poe: "pp", title: "1G PoE++" })], down: [] },
        { id: "wp-u", vlan: "iot", name: "Home Assistant PoE Wallpanel", loc: "Upper Wall Mount", info: "Placeholder. 1G PoE++ uplink · 60W reserved.",
          poeBar: { used: 60, cap: 60 },
          up: [P("wp-u-up", "gbe1", { poe: "pp", title: "1G PoE++" })], down: [] },

        { id: "drop-gar-bak", backup: true, name: "UACC-Keystone-Jack-C6A", loc: "Garage", href: UI + "uacc-keystone-jack-c6a", info: "Backup C6A. Terminated at both ends; cabinet end is not connected to XG.",
          up: [P("drop-gar-bak-up", "gbe10", { poe: "ppp", title: "10G backup keystone · wired to loose cabinet end" })],
          down: [P("drop-gar-bak-dn", "gbe10", { poe: "ppp", title: "10G unused", idle: true })] },
        { id: "drop-gar", name: "UACC-Keystone-Jack-C6A", loc: "Garage", href: UI + "uacc-keystone-jack-c6a", info: "C6A home-run → certified Cat6 short patch → Flex 10G. The second wired run is shown above with a dashed device frame.",
          up: [P("drop-gar-xg", "gbe10", { poe: "ppp", title: "10G ← Pro XG" })],
          down: [P("drop-gar-flex", "gbe10", { poe: "ppp", title: "10G → Flex", child: "flex" })] },
        { id: "flex", vlan: "management", ltr: true, name: "USW-Flex-2.5G-8-PoE", loc: "Garage", href: UI + "usw-flex-2-5g-8-poe", info: "10G RJ45 uplink through the C6A home-run and a certified Cat6 short patch. SFP+ idle (combo). 8×2.5G PoE++. AC-210W nested.",
          embed: [{ name: "UACC-Adapter-AC-210W", href: UI + "uacc-adapter-ac-210w" }],
          devicePower: { value: "17W AC / 14W PoE+++" },
          poeBar: { modes: [
            { label: "PoE Output Used · AC", used: 55.4, cap: 196 },
            { label: "PoE Output Used · PoE+++", used: 55.4, cap: 76 }
          ] },
          up: [
            P("flex-up", "gbe10", { poe: "ppp", title: "10G RJ45 uplink" }),
            P("flex-sfp", "sfp", { t: "SFP+", title: "SFP+ unused · combo", idle: true })
          ],
          down: [
            P("flex-gmin", "gbe2p5", { poe: "pp", title: "2.5G PoE++ → Garage Mini", child: "group-garage-door" }),
            P("flex-tesla", "gbe2p5", { poe: "pp", title: "2.5G PoE++ port → PW3 Leader at 1G", child: "pw-lead" }),
            P("flex-usl", "gbe2p5", { poe: "pp", title: "2.5G PoE++ port → USL at 100M PoE", child: "usl" }),
            P("flex-lite", "gbe2p5", { poe: "pp", title: "2.5G PoE++ port → U7-Lite at PoE", child: "lite" }),
            P("flex-x1", "gbe2p5", { poe: "pp", title: "2.5G PoE++ unused", idle: true }),
            P("flex-x2", "gbe2p5", { poe: "pp", title: "2.5G PoE++ unused", idle: true }),
            P("flex-x3", "gbe2p5", { poe: "pp", title: "2.5G PoE++ unused", idle: true }),
            P("flex-x4", "gbe2p5", { poe: "pp", title: "2.5G PoE++ unused", idle: true })
          ] },
        { id: "lite", vlan: "management", ltr: true, name: "U7-Lite", loc: "Garage", href: UI + "u7-lite", info: "2.5G PoE from Flex.",
          poeBar: { used: 13, cap: 60 },
          up: [P("lite-up", "gbe2p5", { poe: "poe", title: "2.5G PoE" })], down: [] },
        { id: "gar-mini", vlan: "security", ltr: true, name: "UA-Hub-Door-Mini", loc: "Garage Door", href: UI + "ua-hub-door-mini", info: "Uplink from Flex. PoE → G3 and Laneway Turret. REX, DPS, LOCK.",
          devicePower: { value: "19W" },
          poeBar: { label: "PoE Power Used", used: 20, cap: 45 },
          up: [P("gar-mini-up", "gbe1", { poe: "pp", title: "1G PoE++ uplink" })],
          down: [
            P("gar-mini-poe1", "gbe1", { poe: "plus", title: "1G PoE+ port → UA-G3 at 100M PoE", child: "gar-g3" }),
            P("gar-mini-poe2", "gbe1", { poe: "plus", title: "PoE+ → Laneway Turret", child: "lane" }),
            P("gar-mini-rex", "other", { t: "REX", title: "REX unused", idle: true }),
            P("gar-mini-dps", "other", { t: "DPS", title: "DPS → Strike", child: "gar-strike" }),
            P("gar-mini-lock", "other", { t: "LOCK", title: "LOCK 12V → Strike", child: "gar-strike" })
          ] },
        { id: "gar-g3", vlan: "security", ltr: true, hideLoc: true, name: "UA-G3", loc: "Garage Door", href: UI + "ua-g3", info: "PoE from Garage Mini.",
          poeBar: { used: 5, cap: 30 },
          up: [P("gar-g3-up", "fe", { poe: "poe", title: "100M PoE" })], down: [] },
        { id: "gar-strike", ltr: true, hideLoc: true, name: "UACC-Lock-Strike-Secure-15mm", loc: "Garage Door", href: UI + "uacc-lock-strike-secure-15mm", info: "DPS + LOCK 12V from Garage Mini.",
          up: [P("gar-strike-dps", "other", { t: "DPS", title: "DPS" }), P("gar-strike-lock", "other", { t: "LOCK", title: "LOCK 12V" })], down: [] },
        { id: "walk", vlan: "security", tb: true, name: "UVC-G6-Pro-Bullet", loc: "Walkway/Balcony Eave/North East", href: UI + "uvc-g6-pro-bullet", info: "1G PoE+ from Dining Door Mini.",
          poeBar: { used: 15, cap: 30 },
          up: [P("walk-up", "gbe1", { poe: "plus", title: "1G PoE+" })], down: [] },
        { id: "lane", vlan: "security", ltr: true, name: "UVC-G6-Pro-Turret", loc: "Laneway/Garage/South", href: UI + "uvc-g6-pro-turret", info: "1G PoE+ from Garage Door Mini.",
          poeBar: { used: 15, cap: 30 },
          up: [P("lane-up", "gbe1", { poe: "plus", title: "1G PoE+" })], down: [] },
        { id: "usl", vlan: "iot", ltr: true, name: "USL-Gateway", loc: "Garage", href: UI + "usl-gateway", info: "100M PoE from Flex.",
          poeBar: { used: 3.4, cap: 60 },
          up: [P("usl-up", "fe", { poe: "poe", title: "100M PoE" })], down: [] },
        { id: "pw-lead", vlan: "iot", ltr: true, name: "Tesla Powerwall 3 (Leader)", loc: "Garage", href: "https://www.tesla.com/powerwall", info: "LAN from Flex. ETH → Follower. CAN → GW3.",
          up: [P("pw-lead-lan", "gbe1", { title: "1G ← Flex" })],
          down: [P("pw-lead-eth", "gbe1", { title: "1G → Follower", child: "pw-follow" }), P("pw-lead-can", "other", { t: "CAN", title: "CAN → GW3", child: "gw3" })] },
        { id: "pw-follow", vlan: "iot", ltr: true, name: "Tesla Powerwall 3 (Follower)", loc: "Garage", href: "https://www.tesla.com/powerwall", info: "Same ports as Leader: 2×ETH + CAN. Second ETH and CAN unused.",
          up: [P("pw-follow-eth", "gbe1", { title: "1G ← Leader" })],
          down: [
            P("pw-follow-2", "gbe1", { title: "1G unused", idle: true }),
            P("pw-follow-can", "other", { t: "CAN", title: "CAN unused", idle: true })
          ] },
        { id: "gw3", ltr: true, name: "Tesla Gateway 3", loc: "Garage", href: "https://energylibrary.tesla.com/docs/Public/EnergyStorage/Powerwall/General/Datasheet/Gateway/3/en-us/Gateway-3-Datasheet.pdf", info: "CAN from Leader only.",
          up: [P("gw3-can", "other", { t: "CAN", title: "CAN ← Leader" })], down: [] },

        { id: "group-wallpanels", name: "Home Assistant PoE Wallpanel ×3", info: "Three identical XG-fed Wallpanel runs; locations are listed at right.",
          up: [P("wp-b-up", "gbe1", { poe: "pp", title: "1G PoE++" })], down: [],
          bundle: {
            kind: "single", count: 3, source: "wp-b",
            locations: ["Basement Wall Mount", "Main Wall Mount", "Upper Wall Mount"]
          } },
        { id: "group-aps", name: "U7-Pro ×3", info: "Three identical XG-fed U7-Pro runs; locations are listed at right.",
          up: [P("u7b-up", "gbe2p5", { poe: "plus", title: "2.5G PoE+" })], down: [],
          bundle: {
            kind: "single", count: 3, source: "u7b",
            locations: ["Basement", "Main", "Upper"]
          } },
        { id: "group-main-doors", name: "Main House Door Mini Subtrees ×4", info: "Four XG-fed Door Mini branches. Each row preserves its individual uplink, reader, Protect camera, strike, ports, and real SVG links.",
          up: [
            P("front-mini-up", "gbe1", { poe: "pp", title: "Front Mini 1G PoE++ uplink" }),
            P("mud-mini-up", "gbe1", { poe: "pp", title: "Mud Mini 1G PoE++ uplink" }),
            P("din-mini-up", "gbe1", { poe: "pp", title: "Dining Mini 1G PoE++ uplink" }),
            P("bsmt-mini-up", "gbe1", { poe: "pp", title: "Basement Mini 1G PoE++ uplink" })
          ], down: [],
          bundle: DoorHubSubtrees([
              { mini: "front-mini", reader: "front-entry", camera: "cam-fy", strike: "front-strike" },
              { mini: "mud-mini", reader: "mud-g3", camera: "cam-by", strike: "mud-strike" },
              { mini: "din-mini", reader: "din-g3", camera: "walk", strike: "din-strike" },
              { mini: "bsmt-mini", reader: "bsmt-g3", camera: "cam-ct", strike: "bsmt-strike" }
          ]) },
        { id: "group-garage-door", name: "Garage Door Mini Subtree", info: "Garage Door Mini branch rendered by the shared Door Hub subtree component.",
          up: [P("gar-mini-up", "gbe1", { poe: "pp", title: "Garage Mini 1G PoE++ uplink" })], down: [],
          bundle: DoorHubSubtrees([
            { mini: "gar-mini", reader: "gar-g3", camera: "lane", strike: "gar-strike" }
          ]) },
        { id: "group-room-drops", name: "Room Drop + Backup ×5", info: "Five active Cat6A runs connect to XG; five terminated backup runs remain unpatched. Locations are listed at right.",
          up: [P("drop-den-up", "gbe10", { poe: "ppp", title: "10G active keystone" })], down: [],
          bundle: {
            kind: "room", count: 5,
            rows: [
              { source: "drop-den-bak" },
              { source: "drop-den" }
            ],
            locations: ["Main/Den", "Upper/Master Bedroom", "Upper/Bedroom 1", "Upper/Bedroom 2", "Upper/Seating Area"]
          } }
      ];

      function compactIdlePorts(list) {
        var out = [];
        var grouped = {};
        (list || []).forEach(function (port) {
          if (!port.idle || port.child) {
            out.push(port);
            return;
          }
          var key = [port.c, port.poe || "", port.t || "", port.dash ? "dash" : "", port.loose ? "loose" : ""].join("|");
          if (!grouped[key]) {
            grouped[key] = Object.assign({}, port, { count: port.count || 1 });
            out.push(grouped[key]);
          } else {
            grouped[key].count += port.count || 1;
          }
        });
        out.forEach(function (port) {
          if (port.count === 1) delete port.count;
        });
        return out;
      }

      nodes.forEach(function (node) {
        node.up = compactIdlePorts(node.up);
        node.down = compactIdlePorts(node.down);
      });

      var children = {
        nah: ["udm"],
        udm: ["xg"],
        xg: ["ha", "group-wallpanels", "group-main-doors", "group-aps", "view", "nas", "group-room-drops", "drop-media", "drop-gar"],
        "drop-media": ["media-flex"],
        "front-mini": ["front-entry", "cam-fy", "front-strike"],
        "mud-mini": ["mud-g3", "cam-by", "mud-strike"],
        "din-mini": ["din-g3", "walk", "din-strike"],
        "bsmt-mini": ["bsmt-g3", "cam-ct", "bsmt-strike"],
        "drop-gar": ["flex"],
        flex: ["group-garage-door", "pw-lead", "usl", "lite"],
        "pw-lead": ["pw-follow", "gw3"]
      };

      var links = [
        { from: "nah", fp: "nah-10g", to: "udm", tp: "udm-wan", cable: "cat6a", route: "vertical", info: "NAH 10G RJ45 → Cat6A → CM RJ45; CM SFP+ is inserted in UDM WAN." },
        { from: "udm", fp: "udm-lan-sfp", to: "xg", tp: "xg-sfp", cable: "dac", route: "vertical", label: "UACC-DAC-SFP10", href: UI + "10gbps-direct-attach-cable", info: "One UACC-DAC-SFP10: UDM LAN SFP+ → Pro XG SFP28 at 10G." },
        { from: "xg", fp: "xg-nas", to: "nas", tp: "nas-10g", info: "Pro XG 10G → NAS LACP." },
        { from: "xg", fp: "xg-nas2", to: "nas", tp: "nas-10g2", info: "Pro XG 10G → NAS LACP." },
        { from: "xg", fp: "xg-ha", to: "ha", tp: "ha-up", info: "Pro XG 2.5G PoE+++ port → HA Mini PC at PoE++." },
        { from: "xg", fp: "xg-u7b", to: "u7b", tp: "u7b-up", info: "Pro XG → U7-Pro Basement." },
        { from: "xg", fp: "xg-u7m", to: "u7m", tp: "u7m-up", info: "Pro XG → U7-Pro Main." },
        { from: "xg", fp: "xg-u7u", to: "u7u", tp: "u7u-up", info: "Pro XG → U7-Pro Upper." },
        { from: "xg", fp: "xg-den-bak", to: "drop-den-bak", tp: "drop-den-bak-up", info: "Pro XG reserved → Den C6A backup." },
        { from: "xg", fp: "xg-den", to: "drop-den", tp: "drop-den-up", info: "Pro XG → Den C6A." },
        { from: "xg", fp: "xg-master-bak", to: "drop-master-bak", tp: "drop-master-bak-up", info: "Pro XG reserved → Master C6A backup." },
        { from: "xg", fp: "xg-master", to: "drop-master", tp: "drop-master-up", info: "Pro XG → Master C6A." },
        { from: "xg", fp: "xg-br1-bak", to: "drop-br1-bak", tp: "drop-br1-bak-up", info: "Pro XG reserved → Bedroom 1 C6A backup." },
        { from: "xg", fp: "xg-br1", to: "drop-br1", tp: "drop-br1-up", info: "Pro XG → Bedroom 1 C6A." },
        { from: "xg", fp: "xg-br2-bak", to: "drop-br2-bak", tp: "drop-br2-bak-up", info: "Pro XG reserved → Bedroom 2 C6A backup." },
        { from: "xg", fp: "xg-br2", to: "drop-br2", tp: "drop-br2-up", info: "Pro XG → Bedroom 2 C6A." },
        { from: "xg", fp: "xg-seat-bak", to: "drop-seat-bak", tp: "drop-seat-bak-up", info: "Pro XG reserved → Seating C6A backup." },
        { from: "xg", fp: "xg-seat", to: "drop-seat", tp: "drop-seat-up", info: "Pro XG → Seating C6A." },
        { from: "xg", fp: "xg-gar", to: "drop-gar", tp: "drop-gar-xg", info: "Pro XG → Garage C6A." },
        { from: "drop-gar", fp: "drop-gar-flex", to: "flex", tp: "flex-up", cable: "cat6", info: "Garage C6A home-run → certified Cat6 short patch → Flex 10G RJ45 / PoE+++ input." },
        { from: "xg", fp: "xg-front", to: "front-mini", tp: "front-mini-up", info: "Pro XG → Front Mini." },
        { from: "front-mini", fp: "front-mini-poe1", to: "front-entry", tp: "front-entry-up", info: "Front Mini PoE+ → Entry." },
        { from: "front-mini", fp: "front-mini-poe2", to: "cam-fy", tp: "cam-fy-up", cable: "cat6", info: "Front Mini PoE+ → Frontyard Turret." },
        { from: "front-mini", fp: "front-mini-lock", to: "front-strike", tp: "front-strike-lock", info: "Front Mini LOCK → Strike." },
        { from: "front-mini", fp: "front-mini-dps", to: "front-strike", tp: "front-strike-dps", info: "Front Mini DPS → Strike." },
        { from: "xg", fp: "xg-mud", to: "mud-mini", tp: "mud-mini-up", info: "Pro XG → Mud Mini." },
        { from: "mud-mini", fp: "mud-mini-poe1", to: "mud-g3", tp: "mud-g3-up", info: "Mud Mini 1G PoE+ port → UA-G3 at 100M PoE." },
        { from: "mud-mini", fp: "mud-mini-poe2", to: "cam-by", tp: "cam-by-up", cable: "cat6", info: "Mud Mini PoE+ → Backyard Turret." },
        { from: "mud-mini", fp: "mud-mini-lock", to: "mud-strike", tp: "mud-strike-lock", info: "Mud Mini LOCK → Strike." },
        { from: "mud-mini", fp: "mud-mini-dps", to: "mud-strike", tp: "mud-strike-dps", info: "Mud Mini DPS → Strike." },
        { from: "xg", fp: "xg-din", to: "din-mini", tp: "din-mini-up", info: "Pro XG → Dining Mini." },
        { from: "din-mini", fp: "din-mini-poe1", to: "din-g3", tp: "din-g3-up", info: "Dining Mini 1G PoE+ port → UA-G3 at 100M PoE." },
        { from: "din-mini", fp: "din-mini-poe2", to: "walk", tp: "walk-up", cable: "cat6", info: "Dining Mini PoE+ → Walkway Bullet." },
        { from: "din-mini", fp: "din-mini-lock", to: "din-strike", tp: "din-strike-lock", info: "Dining Mini LOCK → Strike." },
        { from: "din-mini", fp: "din-mini-dps", to: "din-strike", tp: "din-strike-dps", info: "Dining Mini DPS → Strike." },
        { from: "xg", fp: "xg-bsmt", to: "bsmt-mini", tp: "bsmt-mini-up", info: "Pro XG → Basement Mini." },
        { from: "bsmt-mini", fp: "bsmt-mini-poe1", to: "bsmt-g3", tp: "bsmt-g3-up", info: "Basement Mini 1G PoE+ port → UA-G3 at 100M PoE." },
        { from: "bsmt-mini", fp: "bsmt-mini-poe2", to: "cam-ct", tp: "cam-ct-up", cable: "cat6", info: "Basement Mini PoE+ → Courtyard Turret." },
        { from: "bsmt-mini", fp: "bsmt-mini-lock", to: "bsmt-strike", tp: "bsmt-strike-lock", info: "Basement Mini LOCK → Strike." },
        { from: "bsmt-mini", fp: "bsmt-mini-dps", to: "bsmt-strike", tp: "bsmt-strike-dps", info: "Basement Mini DPS → Strike." },
        { from: "xg", fp: "xg-view", to: "view", tp: "view-up", info: "Pro XG → Viewport." },
        { from: "xg", fp: "xg-wp-b", to: "wp-b", tp: "wp-b-up", info: "Pro XG 2.5G PoE+++ port → Basement Wallpanel at 1G PoE++." },
        { from: "xg", fp: "xg-wp-m", to: "wp-m", tp: "wp-m-up", info: "Pro XG 2.5G PoE+++ port → Main Wallpanel at 1G PoE++." },
        { from: "xg", fp: "xg-wp-u", to: "wp-u", tp: "wp-u-up", info: "Pro XG 2.5G PoE+++ port → Upper Wallpanel at 1G PoE++." },
        { from: "flex", fp: "flex-gmin", to: "gar-mini", tp: "gar-mini-up", info: "Flex → Garage Mini." },
        { from: "gar-mini", fp: "gar-mini-poe1", to: "gar-g3", tp: "gar-g3-up", info: "Garage Mini PoE → UA-G3." },
        { from: "gar-mini", fp: "gar-mini-poe2", to: "lane", tp: "lane-up", cable: "cat6", info: "Garage Mini PoE+ → Laneway Turret." },
        { from: "gar-mini", fp: "gar-mini-lock", to: "gar-strike", tp: "gar-strike-lock", info: "Garage Mini LOCK → Strike." },
        { from: "gar-mini", fp: "gar-mini-dps", to: "gar-strike", tp: "gar-strike-dps", info: "Garage Mini DPS → Strike." },
        { from: "flex", fp: "flex-usl", to: "usl", tp: "usl-up", info: "Flex 2.5G PoE++ port → USL-Gateway at 100M PoE." },
        { from: "flex", fp: "flex-tesla", to: "pw-lead", tp: "pw-lead-lan", info: "Flex 2.5G PoE++ port → PW3 Leader at 1G; PoE disabled at the endpoint." },
        { from: "flex", fp: "flex-lite", to: "lite", tp: "lite-up", info: "Flex 2.5G PoE++ port → U7-Lite at 2.5G PoE." },
        { from: "pw-lead", fp: "pw-lead-eth", to: "pw-follow", tp: "pw-follow-eth", info: "Leader Ethernet → Follower." },
        { from: "pw-lead", fp: "pw-lead-can", to: "gw3", tp: "gw3-can", info: "Leader CAN → Gateway 3." }
      ];

      var bundledNodeIds = {
        "wp-b": true, "wp-m": true, "wp-u": true,
        "u7b": true, "u7m": true, "u7u": true,
        "front-mini": true, "front-entry": true, "cam-fy": true, "front-strike": true,
        "mud-mini": true, "mud-g3": true, "cam-by": true, "mud-strike": true,
        "din-mini": true, "din-g3": true, "walk": true, "din-strike": true,
        "bsmt-mini": true, "bsmt-g3": true, "cam-ct": true, "bsmt-strike": true,
        "gar-mini": true, "gar-g3": true, "lane": true, "gar-strike": true,
        "drop-den-bak": true, "drop-den": true,
        "drop-master-bak": true, "drop-master": true,
        "drop-br1-bak": true, "drop-br1": true,
        "drop-br2-bak": true, "drop-br2": true,
        "drop-seat-bak": true, "drop-seat": true
      };
      links = links.filter(function (link) {
        return !bundledNodeIds[link.from] && !bundledNodeIds[link.to];
      });
      links = links.concat([
        { from: "xg", fp: "xg-wallpanels", to: "group-wallpanels", tp: "wp-b-up", info: "3× Pro XG 2.5G PoE+++ ports → HA Wallpanels at 1G PoE++." },
        { from: "xg", fp: "xg-aps", to: "group-aps", tp: "u7b-up", info: "3× Pro XG → U7-Pro." },
        { from: "xg", fp: "xg-front", to: "group-main-doors", tp: "front-mini-up", info: "Pro XG → Front Mini." },
        { from: "xg", fp: "xg-mud", to: "group-main-doors", tp: "mud-mini-up", info: "Pro XG → Mud Mini." },
        { from: "xg", fp: "xg-din", to: "group-main-doors", tp: "din-mini-up", info: "Pro XG → Dining Mini." },
        { from: "xg", fp: "xg-bsmt", to: "group-main-doors", tp: "bsmt-mini-up", info: "Pro XG → Basement Mini." },
        { from: "front-mini", fp: "front-mini-poe1", to: "front-entry", tp: "front-entry-up", route: "horizontal", info: "Front Mini PoE+ → Entry." },
        { from: "front-mini", fp: "front-mini-poe2", to: "cam-fy", tp: "cam-fy-up", cable: "cat6", route: "horizontal", info: "Front Mini PoE+ → Frontyard Turret." },
        { from: "front-mini", fp: "front-mini-lock", to: "front-strike", tp: "front-strike-lock", route: "horizontal", info: "Front Mini LOCK → Strike." },
        { from: "front-mini", fp: "front-mini-dps", to: "front-strike", tp: "front-strike-dps", route: "horizontal", info: "Front Mini DPS → Strike." },
        { from: "mud-mini", fp: "mud-mini-poe1", to: "mud-g3", tp: "mud-g3-up", route: "horizontal", info: "Mud Mini 1G PoE+ port → UA-G3 at 100M PoE." },
        { from: "mud-mini", fp: "mud-mini-poe2", to: "cam-by", tp: "cam-by-up", cable: "cat6", route: "horizontal", info: "Mud Mini PoE+ → Backyard Turret." },
        { from: "mud-mini", fp: "mud-mini-lock", to: "mud-strike", tp: "mud-strike-lock", route: "horizontal", info: "Mud Mini LOCK → Strike." },
        { from: "mud-mini", fp: "mud-mini-dps", to: "mud-strike", tp: "mud-strike-dps", route: "horizontal", info: "Mud Mini DPS → Strike." },
        { from: "din-mini", fp: "din-mini-poe1", to: "din-g3", tp: "din-g3-up", route: "horizontal", info: "Dining Mini 1G PoE+ port → UA-G3 at 100M PoE." },
        { from: "din-mini", fp: "din-mini-poe2", to: "walk", tp: "walk-up", cable: "cat6", route: "horizontal", info: "Dining Mini PoE+ → Walkway Bullet." },
        { from: "din-mini", fp: "din-mini-lock", to: "din-strike", tp: "din-strike-lock", route: "horizontal", info: "Dining Mini LOCK → Strike." },
        { from: "din-mini", fp: "din-mini-dps", to: "din-strike", tp: "din-strike-dps", route: "horizontal", info: "Dining Mini DPS → Strike." },
        { from: "bsmt-mini", fp: "bsmt-mini-poe1", to: "bsmt-g3", tp: "bsmt-g3-up", route: "horizontal", info: "Basement Mini 1G PoE+ port → UA-G3 at 100M PoE." },
        { from: "bsmt-mini", fp: "bsmt-mini-poe2", to: "cam-ct", tp: "cam-ct-up", cable: "cat6", route: "horizontal", info: "Basement Mini PoE+ → Courtyard Turret." },
        { from: "bsmt-mini", fp: "bsmt-mini-lock", to: "bsmt-strike", tp: "bsmt-strike-lock", route: "horizontal", info: "Basement Mini LOCK → Strike." },
        { from: "bsmt-mini", fp: "bsmt-mini-dps", to: "bsmt-strike", tp: "bsmt-strike-dps", route: "horizontal", info: "Basement Mini DPS → Strike." },
        { from: "flex", fp: "flex-gmin", to: "group-garage-door", tp: "gar-mini-up", info: "Flex 2.5G PoE++ port → Garage Mini at 1G PoE++." },
        { from: "gar-mini", fp: "gar-mini-poe1", to: "gar-g3", tp: "gar-g3-up", route: "horizontal", info: "Garage Mini PoE+ port → UA-G3 at 100M PoE." },
        { from: "gar-mini", fp: "gar-mini-poe2", to: "lane", tp: "lane-up", cable: "cat6", route: "horizontal", info: "Garage Mini PoE+ → Laneway Turret." },
        { from: "gar-mini", fp: "gar-mini-lock", to: "gar-strike", tp: "gar-strike-lock", route: "horizontal", info: "Garage Mini LOCK → Strike." },
        { from: "gar-mini", fp: "gar-mini-dps", to: "gar-strike", tp: "gar-strike-dps", route: "horizontal", info: "Garage Mini DPS → Strike." },
        { from: "xg", fp: "xg-room-backup", to: "group-room-drops", tp: "drop-den-bak-up", info: "5× wired backup Room Drops → loose cabinet ends; not connected to XG." },
        { from: "xg", fp: "xg-room-live", to: "group-room-drops", tp: "drop-den-up", info: "5× Pro XG → active Room Drop." },
        { from: "xg", fp: "xg-media-backup", to: "drop-media-bak", tp: "drop-media-bak-up", info: "Wired Media Room backup → loose cabinet end; not connected to XG." },
        { from: "xg", fp: "xg-media-live", to: "drop-media", tp: "drop-media-up", info: "Pro XG 10G PoE+++ port → active Media Room Drop." },
        { from: "drop-media", fp: "drop-media-dn", to: "media-flex", tp: "media-flex-up", cable: "cat6a", route: "horizontal", info: "Media Room C6A → non-PoE Flex 2.5G at 10G with PoE+ input." },
        { from: "xg", fp: "xg-gar-backup", to: "drop-gar-bak", tp: "drop-gar-bak-up", info: "Wired Garage backup Room Drop → loose cabinet end; not connected to XG." }
      ]);

      var byId = {};
      nodes.forEach(function (n) { byId[n.id] = n; });

      var stage = document.createElement("div");
      stage.className = "topo-stage";
      canvas.appendChild(stage);

      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "topo-edges");
      svg.setAttribute("aria-hidden", "true");
      var CABLE_COLOR = {
        cat6a: "#e65100",
        cat6: "#1565c0",
        dac: "#111111",
        can: "#00897b",
        lock12: "#8e24aa"
      };
      var defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      Object.keys(CABLE_COLOR).forEach(function (kind) {
        var marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker.setAttribute("id", "topo-arrow-" + kind);
        marker.setAttribute("markerWidth", "7");
        marker.setAttribute("markerHeight", "7");
        marker.setAttribute("refX", "6");
        marker.setAttribute("refY", "3.5");
        marker.setAttribute("orient", "auto");
        marker.setAttribute("markerUnits", "strokeWidth");
        var mpath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        mpath.setAttribute("d", "M0 0 7 3.5 0 7z");
        mpath.setAttribute("fill", CABLE_COLOR[kind]);
        marker.appendChild(mpath);
        defs.appendChild(marker);
      });
      svg.appendChild(defs);
      stage.appendChild(svg);

      var nested = {};
      nodes.forEach(function (n) {
        if (n.nest) n.nest.forEach(function (id) { nested[id] = true; });
      });

      function fmtW(n) {
        var r = Math.round(n * 10) / 10;
        return r === Math.round(r) ? String(Math.round(r)) : String(r);
      }

      function poeBarRow(label, used, cap) {
        var pct = cap ? Math.min(100, (used / cap) * 100) : 0;
        var over = used > cap;
        return '<div class="topo-poe' + (over ? " is-over" : "") + '">' +
          '<div class="topo-poe-head"><span>' + label + "</span>" +
          '<span class="topo-poe-num">' + fmtW(used) + "/" + fmtW(cap) + "W</span></div>" +
          '<div class="topo-poe-track"><span class="topo-poe-fill" style="width:' + pct + '%"></span></div>' +
          "</div>";
      }

      function poeBarHTML(n) {
        if (!n.poeBar) return "";
        if (n.poeBar.modes) {
          return n.poeBar.modes.map(function (m) {
            return poeBarRow(m.label, m.used, m.cap);
          }).join("");
        }
        return poeBarRow(n.poeBar.label || "PoE Power Used", n.poeBar.used, n.poeBar.cap);
      }

      function devicePowerHTML(n) {
        if (!n.devicePower) return "";
        return '<div class="topo-device-power">' +
          "<span>Device Power · w/o PoE output</span>" +
          "<strong>" + n.devicePower.value + "</strong></div>";
      }

      function embedHTML(n) {
        var embeds = (n.embed || []).map(function (e) {
          var name = e.href
            ? '<a class="topo-embed-name" href="' + e.href + '" target="_blank" rel="noopener noreferrer">' + e.name + "</a>"
            : '<span class="topo-embed-name">' + e.name + "</span>";
          return '<span class="topo-embed">' + name + "</span>";
        }).join("");
        return embeds ? '<span class="topo-embeds">' + embeds + "</span>" : "";
      }

      function midHTML(n) {
        var html = n.href
          ? '<a class="topo-name" href="' + n.href + '" target="_blank" rel="noopener noreferrer">' + n.name + "</a>"
          : '<span class="topo-name">' + n.name + "</span>";
        if (n.loc && !nested[n.id] && !n.hideLoc) html += "<small>" + n.loc + "</small>";
        html += embedHTML(n);
        html += devicePowerHTML(n);
        html += poeBarHTML(n);
        return html;
      }

      function downRowHTML(n, side) {
        return downSlots(n, side).map(function (s) {
          return '<span class="topo-slot"' + (s.child ? ' data-child="' + s.child + '"' : "") + ">" + portsHTML(s.ports) + "</span>";
        }).join("");
      }

      function bundleDeviceHTML(id, extraClass, useSlots, showLoc) {
        var n = byId[id];
        if (!n) return "";
        var copy = Object.assign({}, n, { hideLoc: !showLoc });
        return '<div class="topo-bundle-device' + (n.vlan ? " vlan-" + n.vlan : "") + (extraClass ? " " + extraClass : "") + '" data-bundle-source="' + id + '"' + (n.vlan ? ' data-vlan="' + n.vlan + '"' : "") + '>' +
          '<span class="topo-ports up">' + portsHTML(n.up) + "</span>" +
          '<span class="topo-mid">' + midHTML(copy) + "</span>" +
          '<span class="topo-ports down">' + (useSlots ? downRowHTML(n) : portsHTML(n.down)) + "</span>" +
          "</div>";
      }

      function makeBundle(n) {
        var b = n.bundle;
        var box = document.createElement("div");
        box.className = "topo-bundle" + (b.kind === "door-hub-subtrees" ? " topo-bundle-door-matrix" : "");
        box.setAttribute("data-id", n.id);
        box.setAttribute("data-title", n.name);
        box.setAttribute("data-info", n.info);
        box.setAttribute("role", "group");
        box.setAttribute("aria-label", n.name);

        var diagram = "";
        if (b.kind === "single") {
          diagram = '<div class="topo-bundle-row">' +
            bundleDeviceHTML(b.source, "", false) +
            "</div>";
        } else if (b.kind === "door") {
          diagram = '<div class="topo-bundle-door-tree">' +
            bundleDeviceHTML(b.source, "topo-bundle-device-tb topo-bundle-door-root", true) +
            '<div class="topo-bundle-door-children">' +
              bundleDeviceHTML(b.endpoint, "topo-bundle-device-tb", false) +
              bundleDeviceHTML(b.strike, "topo-bundle-device-tb", false) +
            "</div>" +
            "</div>";
        } else if (b.kind === "room") {
          diagram = b.rows.map(function (row) {
            var isBackup = !!byId[row.source].backup;
            return '<div class="topo-bundle-row">' +
              bundleDeviceHTML(row.source, isBackup ? "topo-backup" : "", false, !!b.showLoc) +
              "</div>";
          }).join("");
        } else if (b.kind === "door-hub-subtrees") {
          diagram = b.branches.map(function (branch) {
              return '<div class="topo-door-matrix-row" data-branch="' + branch.mini + '">' +
                '<div class="topo-door-matrix-branch">' +
                  bundleDeviceHTML(branch.mini, "topo-door-matrix-root", true, true) +
                  '<div class="topo-door-matrix-endpoints">' +
                    bundleDeviceHTML(branch.reader, "topo-door-matrix-endpoint topo-door-matrix-reader", false, false) +
                    bundleDeviceHTML(branch.camera, "topo-door-matrix-endpoint topo-door-matrix-camera", false, true) +
                    bundleDeviceHTML(branch.strike, "topo-door-matrix-endpoint topo-door-matrix-strike", false, false) +
                  "</div>" +
                "</div>" +
              "</div>";
            }).join("");
        }

        var locations = (b.locations || []).map(function (loc) {
          return '<span class="topo-bundle-location">' + loc + "</span>";
        }).join("");
        box.innerHTML = '<div class="topo-bundle-port-gutter" aria-hidden="true"></div>' +
          '<div class="topo-bundle-diagram">' + diagram + "</div>" +
          (locations ? '<div class="topo-bundle-locations" aria-label="Locations">' + locations + "</div>" : "");
        return box;
      }

      function makeNode(n) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "topo-node" + (n.vlan ? " vlan-" + n.vlan : "") + (isTB(n.id) ? " topo-tb" : "") + (n.id === "nah" || n.id === "udm" ? " topo-core-vertical" : "") + (n.id === "xg" ? " topo-xg" : "") + (n.corner ? " topo-corner" : "") + (n.backup ? " topo-backup" : "") + (hangsDown(n.id) ? " topo-hang" : "");
        btn.setAttribute("data-id", n.id);
        if (n.vlan) btn.setAttribute("data-vlan", n.vlan);
        btn.setAttribute("data-title", n.name);
        btn.setAttribute("data-info", n.info);
        if (n.id === "xg") {
          btn.innerHTML =
            '<span class="topo-ports up">' + portsHTML(n.up) + "</span>" +
            '<span class="topo-ports down left">' + downRowHTML(n, "left") + "</span>" +
            '<span class="topo-mid">' + midHTML(n) + "</span>" +
            '<span class="topo-ports down right">' + downRowHTML(n, "right") + "</span>";
        } else if (n.corner) {
          btn.innerHTML =
            '<span class="topo-ports up">' + portsHTML(n.up) + "</span>" +
            '<span class="topo-mid">' + midHTML(n) + "</span>" +
            '<span class="topo-ports down"></span>' +
            '<span class="topo-ports bottom">' + downRowHTML(n) + "</span>";
        } else {
          btn.innerHTML =
            '<span class="topo-ports up">' + portsHTML(n.up) + "</span>" +
            '<span class="topo-mid">' + midHTML(n) + "</span>" +
            '<span class="topo-ports down">' + downRowHTML(n) + "</span>";
        }
        return btn;
      }

      function makeApex(n) {
        var box = document.createElement("div");
        box.className = "topo-apex";
        box.setAttribute("data-id", n.id);
        box.setAttribute("data-title", n.name);
        box.setAttribute("data-info", n.info);
        var body = document.createElement("div");
        body.className = "topo-apex-body";
        n.nest.forEach(function (id) {
          body.appendChild(makeNode(byId[id]));
        });
        box.appendChild(body);
        var legend = document.createElement("div");
        legend.className = "topo-apex-legend";
        legend.innerHTML = '<a class="topo-name" href="' + n.href + '" target="_blank" rel="noopener noreferrer">' + n.name + "</a><small>" + n.loc + "</small>";
        box.appendChild(legend);
        return box;
      }

      var els = {};
      function mount(id, parentEl) {
        var n = byId[id];
        if (n.bundle) {
          var bundle = makeBundle(n);
          parentEl.appendChild(bundle);
          els[id] = bundle;
          return;
        }
        if (n.nest) {
          var apex = makeApex(n);
          parentEl.appendChild(apex);
          els[id] = apex;
          n.nest.forEach(function (cid) {
            els[cid] = apex.querySelector('.topo-node[data-id="' + cid + '"]');
          });
          return;
        }
        var el = makeNode(n);
        parentEl.appendChild(el);
        els[id] = el;
      }

      mount("nah", stage);
      function mountTree(id) {
        (children[id] || []).forEach(function (cid) {
          if (!els[cid]) mount(cid, stage);
          mountTree(cid);
        });
      }
      mountTree("nah");
      if (!els["drop-media-bak"]) mount("drop-media-bak", stage);
      if (!els["drop-gar-bak"]) mount("drop-gar-bak", stage);

      var leftFlowRoots = ["ha", "group-wallpanels", "group-main-doors"];
      function markFlowLeft(id) {
        if (!els[id]) return;
        els[id].classList.add("flow-left");
        stageKids(id).forEach(markFlowLeft);
      }
      leftFlowRoots.forEach(markFlowLeft);

      Object.keys(els).forEach(function (id) {
        var a = els[id].querySelectorAll("a");
        Array.prototype.forEach.call(a, function (link) {
          link.addEventListener("click", function (ev) { ev.stopPropagation(); });
        });
      });

      var natural = {};
      var subH = {};
      var subW = {};

      function normalizeDoorHubPoeWidths() {
        [
          ".topo-bundle-door-matrix .topo-door-matrix-root > .topo-mid > .topo-poe",
          ".topo-bundle-door-matrix .topo-door-matrix-endpoint > .topo-mid > .topo-poe"
        ].forEach(function (selector) {
          var bars = stage.querySelectorAll(selector);
          var maxWidth = 0;
          Array.prototype.forEach.call(bars, function (bar) {
            bar.style.width = "";
            bar.style.minWidth = "";
          });
          Array.prototype.forEach.call(bars, function (bar) {
            maxWidth = Math.max(maxWidth, bar.getBoundingClientRect().width);
          });
          if (!maxWidth) return;
          var width = Math.ceil(maxWidth * 10) / 10 + "px";
          Array.prototype.forEach.call(bars, function (bar) {
            bar.style.width = width;
            bar.style.minWidth = width;
          });
        });
      }

      function layoutDoorHubRows() {
        Array.prototype.forEach.call(stage.querySelectorAll(".topo-bundle-door-matrix .topo-door-matrix-row"), function (row) {
          var miniId = row.getAttribute("data-branch");
          var root = row.querySelector(".topo-door-matrix-root");
          var col = root ? root.querySelector(":scope > .topo-ports.down") : null;
          var slots = col ? col.querySelectorAll(":scope > .topo-slot") : [];
          if (!col || slots.length < 4) return;
          var cr = col.getBoundingClientRect();
          var matrixSlots = downSlots(byId[miniId]);
          var placed = {};
          [0, 1, 3].forEach(function (index) {
            var slot = slots[index];
            var spec = matrixSlots[index];
            if (!slot || !spec) return;
            var link = links.filter(function (candidate) {
              return candidate.from === miniId && candidate.fp === spec.ports[0].id;
            })[0];
            var target = link ? portEl(link.tp) : null;
            var probe = slot.querySelector("[data-port]");
            if (!target || !probe) return;
            var sr = slot.getBoundingClientRect();
            var pr = probe.getBoundingClientRect();
            var tr = target.getBoundingClientRect();
            var probeOffset = pr.top + pr.height / 2 - sr.top;
            var top = tr.top + tr.height / 2 - cr.top - probeOffset;
            slot.style.position = "absolute";
            slot.style.top = top + "px";
            placed[index] = top;
          });
          if (slots[2] && placed[3] != null) {
            slots[2].style.position = "absolute";
            slots[2].style.top = (placed[3] - slots[2].offsetHeight - PORT_GAP_MINI) + "px";
          }
        });
      }

      function measureNatural() {
        Object.keys(els).forEach(function (id) {
          var el = els[id];
          el.style.width = "";
          el.style.height = "";
          el.classList.remove("is-fanout");
          el.classList.remove("is-hang-fanout");
          Array.prototype.forEach.call(el.querySelectorAll(".topo-slot"), function (slot) {
            slot.style.top = "";
            slot.style.left = "";
            slot.style.position = "";
            slot.style.paddingTop = "";
          });
          Array.prototype.forEach.call(el.querySelectorAll(".topo-counted-port, .udc-port.loose"), function (port) {
            port.style.position = "";
            port.style.left = "";
            port.style.top = "";
            port.style.transform = "";
          });
          Array.prototype.forEach.call(el.querySelectorAll("[data-port]"), function (port) {
            port.style.position = "";
            port.style.left = "";
            port.style.top = "";
            port.style.transform = "";
          });
        });
        normalizeDoorHubPoeWidths();
        layoutDoorHubRows();
        Object.keys(els).forEach(function (id) {
          var el = els[id];
          var r = el.getBoundingClientRect();
          natural[id] = { w: r.width, h: r.height };
        });
      }

      function isTB(id) {
        return id === "nah" || id === "udm";
      }

      function isFanout(id) {
        return downSlots(byId[id] || {}).filter(function (s) { return s.child; }).length > 1;
      }

      function hangsDown(id) {
        return false;
      }

      function downsFaceDown(id) {
        return hangsDown(id) || isTB(id);
      }

      function upsFaceUp(id) {
        return isTB(id);
      }

      function stacksChildBelow(id) {
        return id === "drop-gar";
      }

      function pairedBackupId(id) {
        return id === "drop-media" ? "drop-media-bak"
          : id === "drop-gar" ? "drop-gar-bak"
          : null;
      }

      function isHangFanout(id) {
        return hangsDown(id) && isFanout(id);
      }

      function isLTRFanout(id) {
        return id !== "xg" && isFanout(id) && !isTB(id) && !hangsDown(id);
      }

      function hasHangBelow(id) {
        var kids = stageKids(id);
        for (var i = 0; i < kids.length; i++) {
          if (hangsDown(kids[i]) || hasHangBelow(kids[i])) return true;
        }
        return false;
      }

      function isDoorMini(id) {
        return /-mini$/.test(id || "");
      }

      function gapDown(id) {
        return isDoorMini(id) ? GAP_MINI : GAP_Y;
      }

      function boxPad(id) {
        return isDoorMini(id) ? BOX_PAD_MINI : BOX_PAD;
      }

      function stageKids(id) {
        return (children[id] || []).filter(function (k) { return !nested[k]; });
      }

      function inboundPort(id) {
        var n = byId[id];
        if (n && n.inbound) return n.inbound;
        if (n && n.nest) {
          var inner = byId[n.nest[0]];
          return inner.up && inner.up[0] ? inner.up[0].id : null;
        }
        if (n && n.up && n.up[0]) return n.up[0].id;
        var hit = links.filter(function (L) { return L.to === id; })[0];
        if (hit) return hit.tp;
        return null;
      }

      function bandH(id) {
        return boxHeight(id);
      }

      function slotH(s, parentId) {
        if (s.child) {
          var backupId = pairedBackupId(s.child);
          if (backupId && natural[backupId]) {
            var pairedBranchH = boxHeight(s.child);
            stageKids(s.child).forEach(function (childId) {
              pairedBranchH = Math.max(pairedBranchH, subtreeH(childId));
            });
            return Math.max(SLOT_MIN, pairedBranchH + natural[backupId].h + 8);
          }
          if (hangsDown(s.child)) return Math.max(SLOT_MIN, subtreeH(s.child));
          if (hasHangBelow(s.child)) return Math.max(SLOT_MIN, boxHeight(s.child));
          return Math.max(SLOT_MIN, subtreeH(s.child));
        }
        return isDoorMini(parentId) ? SLOT_IDLE_MINI : SLOT_MIN;
      }

      function kidsRowW(id) {
        var kids = stageKids(id);
        var w = 0;
        kids.forEach(function (k, i) {
          w += subtreeW(k);
          if (i) w += GAP_X;
        });
        return w;
      }

      function horizontalGap(fromId, toId) {
        return GAP_X;
      }

      function hangWidth(id) {
        return natural[id].w;
      }

      function slotsSum(id) {
        var slots = downSlots(byId[id]);
        return slotsListSum(slots, id);
      }

      function slotsListSum(slots, id, suppliedGap) {
        var g = suppliedGap == null ? gapDown(id) : suppliedGap;
        var s = 0;
        slots.forEach(function (slot, i) {
          s += slotH(slot, id);
          if (i) s += g;
        });
        return s;
      }

      function kidsSumH(id) {
        var kids = stageKids(id);
        var s = 0;
        kids.forEach(function (k, i) { s += subtreeH(k); if (i) s += GAP_Y; });
        return s;
      }

      function boxHeight(id) {
        if (isLTRFanout(id)) return Math.max(natural[id].h, slotsSum(id) + boxPad(id));
        return natural[id].h;
      }

      function subtreeH(id) {
        if (subH[id] != null) return subH[id];
        var bh = boxHeight(id);
        var self = bandH(id);
        var kids = stageKids(id);
        var h;
        if (hangsDown(id) && isHangFanout(id)) {
          var maxH = 0;
          kids.forEach(function (k) { maxH = Math.max(maxH, subtreeH(k)); });
          h = bh + (kids.length ? GAP_TB + maxH : 0);
        } else if (hangsDown(id)) {
          h = bh + (kids.length ? GAP_TB + kidsSumH(id) : 0);
        } else if (kids.length === 1 && hangsDown(kids[0]) && (downsFaceDown(id) || stacksChildBelow(id))) {
          h = bh + GAP_TB + subtreeH(kids[0]);
        } else if (kids.length === 1 && hangsDown(kids[0])) {
          h = Math.max(bh, subtreeH(kids[0]));
        } else if (isTB(id) && kids.length === 1 && isTB(kids[0])) {
          h = bh + GAP_TB + subtreeH(kids[0]);
        } else if (isTB(id) && kids.length === 1) {
          h = Math.max(self, subtreeH(kids[0]));
        } else if (isLTRFanout(id)) {
          h = Math.max(self, slotsSum(id) + boxPad(id));
        } else if (kids.length) {
          h = Math.max(self, kidsSumH(id));
        } else {
          h = self;
        }
        subH[id] = h;
        return h;
      }

      function subtreeW(id) {
        if (subW[id] != null) return subW[id];
        var bw = natural[id].w;
        var kids = stageKids(id);
        var w;
        if (hangsDown(id) && isHangFanout(id)) {
          w = Math.max(bw, kidsRowW(id));
        } else if (hangsDown(id)) {
          var maxC = bw;
          kids.forEach(function (k) { maxC = Math.max(maxC, subtreeW(k)); });
          w = maxC;
        } else if (kids.length === 1 && hangsDown(kids[0]) && (downsFaceDown(id) || stacksChildBelow(id))) {
          w = Math.max(bw, subtreeW(kids[0]));
        } else if (kids.length === 1 && hangsDown(kids[0])) {
          w = bw + GAP_X + subtreeW(kids[0]);
        } else if (isTB(id) && kids.length === 1 && isTB(kids[0])) {
          w = Math.max(bw, subtreeW(kids[0]));
        } else if (kids.length) {
          var maxC = 0;
          kids.forEach(function (k) { maxC = Math.max(maxC, subtreeW(k)); });
          w = bw + (kids.length === 1 ? horizontalGap(id, kids[0]) : GAP_X) + maxC;
        } else {
          w = bw;
        }
        subW[id] = w;
        return w;
      }

      function applySlotHeights(id) {
        if (!isLTRFanout(id)) return;
        els[id].classList.add("is-fanout");
      }

      function coverFanout(id) {
        if (!isLTRFanout(id)) return;
        var el = els[id];
        var top = parseFloat(el.style.top || 0);
        var bot = top + (natural[id] ? natural[id].h : 0);
        stageKids(id).forEach(function (cid) {
          var c = els[cid];
          if (!c) return;
          bot = Math.max(bot, parseFloat(c.style.top || 0) + c.offsetHeight);
        });
        el.style.height = Math.max(natural[id].h, bot - top) + "px";
      }

      function pinFanoutUpPorts(id) {
        if (id !== "flex" || !isLTRFanout(id) || !els[id]) return;
        var el = els[id];
        var col = el.querySelector(":scope > .topo-ports.up");
        if (!col) return;
        var inbound = links.filter(function (link) {
          return link.to === id && col.querySelector('[data-port="' + link.tp + '"]');
        })[0];
        if (!inbound) return;
        var source = portEl(inbound.fp);
        var active = col.querySelector('[data-port="' + inbound.tp + '"]');
        if (!source || !active) return;
        var item = active.closest(".topo-counted-port") || active;
        var cr = col.getBoundingClientRect();
        var ir = item.getBoundingClientRect();
        var ar = active.getBoundingClientRect();
        var iconOffset = ar.top + ar.height / 2 - ir.top;
        var targetCenter = cr.top + cr.height / 2;
        var activeTop = targetCenter - cr.top - iconOffset;
        item.style.position = "absolute";
        item.style.left = "50%";
        item.style.top = activeTop + "px";
        item.style.transform = "translateX(-50%)";
        var cursor = activeTop + item.offsetHeight + PORT_GAP_MINI;
        Array.prototype.forEach.call(col.children, function (other) {
          if (other === item || other.contains(item)) return;
          other.style.position = "absolute";
          other.style.left = "50%";
          other.style.top = cursor + "px";
          other.style.transform = "translateX(-50%)";
          cursor += other.offsetHeight + PORT_GAP_MINI;
        });
      }

      function pinCenteredPortBand(row, activePortId) {
        if (!row) return;
        var active = row.querySelector('[data-port="' + activePortId + '"]');
        if (!active) return;
        var item = active.closest(".topo-slot") || active.closest(".topo-counted-port") || active;
        while (item.parentElement !== row && item.parentElement) item = item.parentElement;
        var rr = row.getBoundingClientRect();
        var ir = item.getBoundingClientRect();
        var ar = active.getBoundingClientRect();
        var iconOffsetX = ar.left + ar.width / 2 - ir.left;
        var itemLeft = rr.width / 2 - iconOffsetX;
        item.style.position = "absolute";
        item.style.left = itemLeft + "px";
        item.style.top = Math.max(0, (rr.height - ir.height) / 2) + "px";
        item.style.transform = "none";

        var cursor = itemLeft + ir.width + 6;
        Array.prototype.forEach.call(row.children, function (other) {
          if (other === item || other.contains(item)) return;
          var or = other.getBoundingClientRect();
          other.style.position = "absolute";
          other.style.left = cursor + "px";
          other.style.top = Math.max(0, (rr.height - or.height) / 2) + "px";
          other.style.transform = "none";
          cursor += or.width + 6;
        });
      }

      function pinCorePortBands() {
        if (els.nah) {
          pinCenteredPortBand(els.nah.querySelector(":scope > .topo-ports.up"), "nah-pon");
          pinCenteredPortBand(els.nah.querySelector(":scope > .topo-ports.down"), "nah-10g");
        }
        if (els.udm) {
          pinCenteredPortBand(els.udm.querySelector(":scope > .topo-ports.up"), "udm-wan");
          pinCenteredPortBand(els.udm.querySelector(":scope > .topo-ports.down"), "udm-lan-sfp");
        }
        if (els.xg) {
          pinCenteredPortBand(els.xg.querySelector(":scope > .topo-ports.up"), "xg-sfp");
        }
      }

      function xgSideSlots(side) {
        return downSlots(byId.xg, side);
      }

      function xgBranchSlots(side) {
        var slots = xgSideSlots(side);
        var lastChild = -1;
        slots.forEach(function (slot, index) {
          if (slot.child) lastChild = index;
        });
        return slots.slice(0, lastChild + 1);
      }

      function xgSideGap(side) {
        if (side === "left") return GAP_Y;
        var left = xgBranchSlots("left");
        var right = xgBranchSlots("right");
        var target = slotsListSum(left, "xg", GAP_Y);
        var slotTotal = 0;
        right.forEach(function (slot) { slotTotal += slotH(slot, "xg"); });
        return right.length > 1 ? Math.max(GAP_Y, (target - slotTotal) / (right.length - 1)) : 0;
      }

      function xgSideHeight(side) {
        var slots = xgBranchSlots(side);
        return slotsListSum(slots, "xg", xgSideGap(side));
      }

      function pinXgSidePorts(side) {
        if (!els.xg) return;
        var col = els.xg.querySelector(":scope > .topo-ports." + side);
        if (!col) return;
        var specs = xgSideSlots(side);
        var slots = col.querySelectorAll(":scope > .topo-slot");
        var cr = col.getBoundingClientRect();
        specs.forEach(function (spec, index) {
          var slot = slots[index];
          if (!slot || !spec.child) return;
          var target = portEl(inboundPort(spec.child));
          var probe = slot.querySelector("[data-port]");
          if (!target || !probe) return;
          var sr = slot.getBoundingClientRect();
          var pr = probe.getBoundingClientRect();
          var tr = target.getBoundingClientRect();
          var probeOffset = pr.top + pr.height / 2 - sr.top;
          slot.style.top = (tr.top + tr.height / 2 - cr.top - probeOffset) + "px";
        });
        pinTrailingIdleSlots("xg", col, slots, specs, xgSideGap(side));
      }

      function pinXgPorts() {
        pinXgSidePorts("left");
        pinXgSidePorts("right");
        pinAllXgLinkedPorts();
        centerXgVisiblePortBands();
        pinCorePortBands();
      }

      function pinAllXgLinkedPorts() {
        links.filter(function (link) { return link.from === "xg"; }).forEach(function (link) {
          var source = portEl(link.fp);
          var target = portEl(link.tp);
          var slot = source && source.closest(".topo-slot");
          if (!source || !target || !slot) return;
          var item = source.closest(".topo-counted-port") || source;
          var sr = slot.getBoundingClientRect();
          var ir = item.getBoundingClientRect();
          var pr = source.getBoundingClientRect();
          var tr = target.getBoundingClientRect();
          var iconOffset = pr.top + pr.height / 2 - ir.top;
          item.style.position = "absolute";
          item.style.left = "50%";
          item.style.top = (tr.top + tr.height / 2 - sr.top - iconOffset) + "px";
          item.style.transform = "translateX(-50%)";
        });
      }

      function centerXgVisiblePortBand(side) {
        var col = els.xg && els.xg.querySelector(":scope > .topo-ports." + side);
        if (!col) return;
        var slots = Array.prototype.slice.call(col.querySelectorAll(":scope > .topo-slot"));
        var entries = slots.map(function (slot, index) {
          var ports = Array.prototype.slice.call(slot.querySelectorAll("[data-port]"));
          if (!ports.length) return null;
          var rects = ports.map(function (port) { return port.getBoundingClientRect(); });
          return {
            index: index,
            slot: slot,
            top: Math.min.apply(null, rects.map(function (rect) { return rect.top; })),
            bottom: Math.max.apply(null, rects.map(function (rect) { return rect.bottom; }))
          };
        }).filter(Boolean);
        if (!entries.length) return;
        var cr = col.getBoundingClientRect();
        var topEntry = entries.reduce(function (best, entry) { return entry.top < best.top ? entry : best; });
        var bottomEntry = entries.reduce(function (best, entry) { return entry.bottom > best.bottom ? entry : best; });
        var offset = (cr.top + cr.bottom - topEntry.top - bottomEntry.bottom) / 2;
        if (Math.abs(offset) < 0.4) return;

        var specs = xgSideSlots(side);
        var movable = side === "right"
          ? entries.filter(function (entry) { return specs[entry.index] && !specs[entry.index].child; }).pop()
          : bottomEntry;
        if (!movable) movable = offset > 0 ? topEntry : bottomEntry;
        movable.slot.style.top = ((parseFloat(movable.slot.style.top) || 0) + 2 * offset) + "px";
      }

      function centerXgVisiblePortBands() {
        centerXgVisiblePortBand("right");
      }

      function containPinnedSlots(id, axis) {
        var el = els[id];
        if (!el) return;
        var col = axis === "x" ? hangDownCol(el) : el.querySelector(".topo-ports.down");
        if (!col) return;
        var items = col.querySelectorAll(".topo-slot, [data-port]");
        if (!items.length) return;
        var er = el.getBoundingClientRect();
        var cs = window.getComputedStyle(el);
        if (axis === "x") {
          var maxRight = er.left;
          Array.prototype.forEach.call(items, function (item) {
            maxRight = Math.max(maxRight, item.getBoundingClientRect().right);
          });
          var rightLimit = er.right - (parseFloat(cs.paddingRight) || 0);
          var growX = Math.ceil(maxRight - rightLimit);
          if (growX > 0) el.style.width = (el.offsetWidth + growX) + "px";
          return;
        }
        var maxBottom = er.top;
        Array.prototype.forEach.call(items, function (item) {
          maxBottom = Math.max(maxBottom, item.getBoundingClientRect().bottom);
        });
        if (id === "flex") {
          stageKids(id).forEach(function (childId) {
            if (els[childId]) maxBottom = Math.max(maxBottom, els[childId].getBoundingClientRect().bottom);
          });
        }
        el.style.height = Math.ceil(maxBottom - er.top + (parseFloat(cs.paddingBottom) || 0)) + "px";
      }

      function pinTrailingIdleSlots(id, col, slots, suppliedSpecs, suppliedGap) {
        var specs = suppliedSpecs || downSlots(byId[id]);
        var slotGap = suppliedGap == null ? gapDown(id) : suppliedGap;
        var lastChild = -1;
        specs.forEach(function (spec, index) {
          if (spec.child) lastChild = index;
        });
        if (lastChild < 0 || lastChild >= specs.length - 1) return;
        for (var i = lastChild + 1; i < specs.length; i++) {
          if (specs[i].child) return;
        }
        var cr = col.getBoundingClientRect();
        var maxBottom = cr.top;
        for (var j = 0; j <= lastChild; j++) {
          Array.prototype.forEach.call(slots[j].querySelectorAll("[data-port]"), function (port) {
            maxBottom = Math.max(maxBottom, port.getBoundingClientRect().bottom);
          });
        }
        var cursor = maxBottom - cr.top + slotGap;
        for (var k = lastChild + 1; k < specs.length; k++) {
          slots[k].style.top = cursor + "px";
          cursor += slots[k].offsetHeight + slotGap;
        }
      }

      function pinDownPorts(id) {
        if (!isLTRFanout(id) || !els[id]) return;
        var el = els[id];
        pinFanoutUpPorts(id);
        var col = el.querySelector(".topo-ports.down");
        if (!col) return;
        var slots = col.querySelectorAll(".topo-slot");
        var cr = col.getBoundingClientRect();
        var used = [];
        downSlots(byId[id]).forEach(function (s, i) {
          var slot = slots[i];
          if (!slot) return;
          if (id === "xg" && s.child === "nas") slot.style.gap = "0.1rem";
          slot.style.paddingTop = "0px";
          slot.style.justifyContent = "center";
          if (!s.child) return;
          var p = portEl(inboundPort(s.child));
          var probe = slot.querySelector("[data-port]");
          if (!p || !probe) return;
          var pr = p.getBoundingClientRect();
          var off = probe.offsetTop + probe.offsetHeight / 2;
          var top = pr.top + pr.height / 2 - cr.top - off;
          slot.style.top = top + "px";
          used.push({ i: i, top: top, sh: slot.offsetHeight || 17 });
        });
        var idleTop = 6;
        if (used.length) {
          used.sort(function (a, b) { return a.top - b.top; });
          idleTop = used[used.length - 1].top + used[used.length - 1].sh + gapDown(id);
        }
        downSlots(byId[id]).forEach(function (s, i) {
          if (s.child || !slots[i]) return;
          var prev = null, next = null;
          used.forEach(function (u) {
            if (u.i < i) prev = u;
            if (u.i > i && !next) next = u;
          });
          var slot = slots[i];
          var sh = slot.offsetHeight || 17;
          if (prev && next) {
            slot.style.top = (prev.top + prev.sh + (next.top - prev.top - prev.sh - sh) / 2) + "px";
          } else {
            slot.style.top = idleTop + "px";
            idleTop += sh + gapDown(id);
          }
        });
        if (isDoorMini(id) && slots[2]) {
          var dpsSlot = used.filter(function (entry) { return entry.i === 3; })[0];
          if (dpsSlot) {
            slots[2].style.top = (dpsSlot.top - slots[2].offsetHeight - PORT_GAP_MINI) + "px";
          }
        }
        pinTrailingIdleSlots(id, col, slots);
        containPinnedSlots(id, "y");
        pinFanoutUpPorts(id);
      }

      function pinHangChildren(id) {
        if (!hangsDown(id) || !els[id]) return;
        downSlots(byId[id]).forEach(function (s) {
          if (!s.child) return;
          var a = portEl(s.ports[0].id);
          var b = portEl(inboundPort(s.child));
          if (!a || !b) return;
          var ar = a.getBoundingClientRect();
          var br = b.getBoundingClientRect();
          var dx = (ar.left + ar.width / 2) - (br.left + br.width / 2);
          if (Math.abs(dx) >= 0.4) shiftTree(s.child, dx, 0);
        });
      }

      function hangDownCol(el) {
        return el.querySelector(".topo-ports.bottom") || el.querySelector(".topo-ports.down");
      }

      function coverHangFanout(id) {
        var el = els[id];
        var left = parseFloat(el.style.left || 0);
        var right = left + (natural[id] ? natural[id].w : el.offsetWidth);
        stageKids(id).forEach(function (cid) {
          var c = els[cid];
          if (!c) return;
          right = Math.max(right, parseFloat(c.style.left || 0) + c.offsetWidth);
        });
        el.style.width = Math.max(natural[id].w, right - left) + "px";
      }

      function pinHangPorts(id) {
        if (!isHangFanout(id) || !els[id]) return;
        var el = els[id];
        el.classList.add("is-hang-fanout");
        var col = hangDownCol(el);
        if (!col) return;
        var slots = col.querySelectorAll(".topo-slot");
        var cr = col.getBoundingClientRect();
        var used = [];
        downSlots(byId[id]).forEach(function (s, i) {
          var slot = slots[i];
          if (!slot || !s.child) return;
          var p = portEl(inboundPort(s.child));
          var probe = slot.querySelector("[data-port]");
          if (!p || !probe) return;
          var pr = p.getBoundingClientRect();
          var off = probe.offsetLeft + probe.offsetWidth / 2;
          var left = pr.left + pr.width / 2 - cr.left - off;
          slot.style.left = left + "px";
          used.push({ i: i, left: left, sw: slot.offsetWidth || 28 });
        });
        used.sort(function (a, b) { return a.i - b.i; });
        var all = downSlots(byId[id]);
        if (isDoorMini(id) && slots.length >= 4) {
          Array.prototype.forEach.call(slots, function (slot) {
            slot.style.gap = PORT_GAP_MINI + "px";
          });
          var firstUsed = used.filter(function (u) { return u.i === 0; })[0];
          var lastUsed = used.filter(function (u) { return u.i === 3; })[0];
          if (firstUsed && lastUsed && slots[1] && slots[2]) {
            if (!all[1].child) slots[1].style.left = firstUsed.left + firstUsed.sw + PORT_GAP_MINI + "px";
            if (!all[2].child) slots[2].style.left = lastUsed.left - slots[2].offsetWidth - PORT_GAP_MINI + "px";
            containPinnedSlots(id, "x");
            return;
          }
        }
        var i = 0;
        while (i < all.length) {
          if (all[i].child || !slots[i]) {
            i++;
            continue;
          }
          var start = i;
          while (i < all.length && !all[i].child && slots[i]) i++;
          var end = i;
          var prev = null, next = null;
          used.forEach(function (u) {
            if (u.i < start) prev = u;
            if (u.i >= end && !next) next = u;
          });
          var total = 0;
          for (var j = start; j < end; j++) total += slots[j].offsetWidth || 28;
          var gap = 8;
          var left;
          if (prev && next) {
            var room = next.left - (prev.left + prev.sw);
            gap = Math.max(2, (room - total) / (end - start + 1));
            left = prev.left + prev.sw + gap;
          } else if (prev) {
            left = prev.left + prev.sw + gap;
          } else if (next) {
            left = Math.max(0, next.left - total - gap * (end - start));
          } else {
            left = 0;
          }
          for (var k = start; k < end; k++) {
            slots[k].style.left = left + "px";
            left += (slots[k].offsetWidth || 28) + gap;
          }
        }
        containPinnedSlots(id, "x");
      }

      function pinAllFanout() {
        Object.keys(els).forEach(function (id) {
          if (isHangFanout(id)) {
            coverHangFanout(id);
            pinHangPorts(id);
          } else if (hangsDown(id)) pinHangChildren(id);
          else pinDownPorts(id);
        });
      }

      function bundleLeftInset(el) {
        if (!el) return GAP_X;
        var device = el.querySelector(".topo-bundle-device");
        if (!device) return GAP_X;
        var er = el.getBoundingClientRect();
        var dr = device.getBoundingClientRect();
        return dr.left - er.left;
      }

      function placeInSlot(id, x, slotTop, slotHgt) {
        /* Pull group frames over source ports and preserve inner left padding. */
        if (byId[id] && byId[id].bundle) {
          x -= bundleLeftInset(els[id]);
        }
        var backupId = pairedBackupId(id);
        if (backupId && natural[backupId]) {
          place(id, x, slotTop + natural[backupId].h + 8);
          return;
        }
        if (hangsDown(id)) {
          place(id, x, slotTop);
          return;
        }
        var h = natural[id] ? natural[id].h : 0;
        place(id, x, slotTop + Math.max(0, (slotHgt - h) / 2));
      }

      function nearDeviceEdge(id, side) {
        var el = els[id];
        if (!el) return 0;
        var device = byId[id] && byId[id].bundle ? el.querySelector(".topo-bundle-device") : el;
        var sr = stage.getBoundingClientRect();
        var dr = (device || el).getBoundingClientRect();
        return side === "left" ? dr.right - sr.left : dr.left - sr.left;
      }

      function placeLeftInSlot(id, anchorRight, slotTop, slotHgt) {
        var h = natural[id] ? natural[id].h : 0;
        place(id, 0, slotTop + Math.max(0, (slotHgt - h) / 2));
        var dx = anchorRight - nearDeviceEdge(id, "left");
        if (Math.abs(dx) >= 0.4) shiftTree(id, dx, 0);
      }

      function xgRequiredHeight() {
        var el = els.xg;
        var leftH = xgSideHeight("left");
        var rightH = xgSideHeight("right");
        var up = el.querySelector(":scope > .topo-ports.up");
        var mid = el.querySelector(":scope > .topo-mid");
        var cs = window.getComputedStyle(el);
        var pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
        var border = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
        var rowGap = parseFloat(cs.rowGap) || 0;
        var headerH = (up ? up.offsetHeight : 0) + (mid ? mid.offsetHeight : 0) + 2 * rowGap;
        var bodyH = Math.max(leftH, rightH);
        return Math.ceil(border + pad + headerH + bodyH);
      }

      function fitXgLowerSection() {
        var el = els.xg;
        var col = el && el.querySelector(":scope > .topo-ports.left");
        if (!col) return;
        var delta = Math.max(xgSideHeight("left"), xgSideHeight("right")) - col.getBoundingClientRect().height;
        if (Math.abs(delta) >= 0.05) {
          el.style.height = (el.getBoundingClientRect().height + delta) + "px";
        }
      }

      function placeXgSide(side) {
        var el = els.xg;
        var col = el.querySelector(":scope > .topo-ports." + side);
        if (!col) return;
        var specs = xgSideSlots(side);
        var slots = col.querySelectorAll(":scope > .topo-slot");
        var stageRect = stage.getBoundingClientRect();
        var colRect = col.getBoundingClientRect();
        var stackHeight = xgSideHeight(side);
        var colTop = colRect.top - stageRect.top;
        var cursor = colTop + Math.max(0, (colRect.height - stackHeight) / 2);
        var gap = xgSideGap(side);
        var anchor = side === "left"
          ? parseFloat(el.style.left || 0) - GAP_X
          : parseFloat(el.style.left || 0) + el.offsetWidth + GAP_X;

        specs.forEach(function (spec, index) {
          var h = slotH(spec, "xg");
          var slot = slots[index];
          if (slot) {
            slot.style.top = (cursor - colTop + Math.max(0, (h - slot.offsetHeight) / 2)) + "px";
          }
          if (spec.child) {
            if (side === "left") placeLeftInSlot(spec.child, anchor, cursor, h);
            else placeInSlot(spec.child, anchor, cursor, h);
          }
          cursor += h + gap;
        });
      }

      function balanceXgBranchExtents() {
        var left = xgBranchSlots("left").filter(function (slot) { return slot.child; });
        var right = xgBranchSlots("right").filter(function (slot) { return slot.child; });
        if (left.length < 2 || right.length < 2) return;
        var leftTop = treeBox(left[0].child).top;
        var leftBottom = treeBox(left[left.length - 1].child).bottom;
        var boxes = right.map(function (slot) {
          var box = treeBox(slot.child);
          var backupId = pairedBackupId(slot.child);
          if (backupId && els[backupId]) {
            var backupTop = parseFloat(els[backupId].style.top || 0);
            box = {
              top: Math.min(box.top, backupTop),
              bottom: Math.max(box.bottom, backupTop + els[backupId].offsetHeight),
              left: box.left,
              right: box.right
            };
          }
          return box;
        });
        var occupied = boxes.reduce(function (sum, box) { return sum + box.bottom - box.top; }, 0);
        var gap = Math.max(GAP_Y, ((leftBottom - leftTop) - occupied) / (right.length - 1));
        var cursor = leftTop;
        right.forEach(function (slot, index) {
          var dy = cursor - boxes[index].top;
          if (Math.abs(dy) >= 0.4) shiftTree(slot.child, 0, dy);
          var backupId = pairedBackupId(slot.child);
          if (backupId && els[backupId] && Math.abs(dy) >= 0.4) {
            shiftTree(backupId, 0, dy);
          }
          cursor += boxes[index].bottom - boxes[index].top + gap;
        });
      }

      function placeDenseTopology() {
        var xg = els.xg;
        var nah = els.nah;
        var udm = els.udm;
        var nahTop = PAD;
        var udmTop = nahTop + natural.nah.h + GAP_CORE;
        var xgTop = udmTop + natural.udm.h + GAP_CORE_DAC;

        xg.style.left = "0px";
        xg.style.top = xgTop + "px";
        xg.style.height = xgRequiredHeight() + "px";
        fitXgLowerSection();

        var coreWidth = xg.getBoundingClientRect().width;
        var xgCenter = parseFloat(xg.style.left || 0) + coreWidth / 2;
        nah.style.width = coreWidth + "px";
        udm.style.width = coreWidth + "px";
        nah.style.left = (xgCenter - coreWidth / 2) + "px";
        nah.style.top = nahTop + "px";
        udm.style.left = (xgCenter - coreWidth / 2) + "px";
        udm.style.top = udmTop + "px";

        placeXgSide("left");
        placeXgSide("right");
        pinCorePortBands();
      }

      function placeHang(id, x, y) {
        var el = els[id];
        el.classList.add("topo-hang");
        el.style.width = "";
        el.style.height = "";
        el.style.left = x + "px";
        el.style.top = y + "px";
        var bw = el.offsetWidth || natural[id].w;
        var bh = el.offsetHeight || natural[id].h;
        var kids = stageKids(id);
        var cy = y + bh + GAP_TB;
        if (isHangFanout(id)) {
          var cx = x;
          kids.forEach(function (cid) {
            place(cid, cx, cy);
            cx += subtreeW(cid) + GAP_X;
          });
          coverHangFanout(id);
          pinHangPorts(id);
        } else {
          kids.forEach(function (cid) {
            var cw = natural[cid] ? natural[cid].w : 0;
            place(cid, x + Math.max(0, (bw - cw) / 2), cy);
            cy += subtreeH(cid) + GAP_Y;
          });
          pinHangChildren(id);
        }
      }

      function place(id, x, y) {
        if (hangsDown(id)) {
          placeHang(id, x, y);
          return;
        }
        var el = els[id];
        if (isLTRFanout(id)) applySlotHeights(id);
        var bw = natural[id].w;
        var bh = el.offsetHeight || natural[id].h;
        el.style.left = x + "px";
        el.style.top = y + "px";
        var kids = stageKids(id);
        if (!kids.length) return;
        if (kids.length === 1 && hangsDown(kids[0])) {
          var hw = natural[kids[0]].w;
          if (downsFaceDown(id) || stacksChildBelow(id)) {
            place(kids[0], x + (bw - hw) / 2, y + bh + GAP_TB);
          } else {
            place(kids[0], x + bw + GAP_X, y);
          }
          return;
        }
        if (isTB(id) && kids.length === 1 && isTB(kids[0])) {
          var cw = natural[kids[0]].w;
          place(kids[0], x + (bw - cw) / 2, y + bh + GAP_TB);
          return;
        }
        if (isTB(id) && kids.length === 1) {
          place(kids[0], x + bw + horizontalGap(id, kids[0]), y);
          return;
        }
        var cx = x + bw + (kids.length === 1 ? horizontalGap(id, kids[0]) : GAP_X);
        if (isLTRFanout(id)) {
          var g = gapDown(id);
          var cursor = y;
          downSlots(byId[id]).forEach(function (s) {
            var h = slotH(s, id);
            if (s.child) placeInSlot(s.child, cx, cursor, h);
            cursor += h + g;
          });
          coverFanout(id);
          pinDownPorts(id);
        } else if (kids.length === 1) {
          place(kids[0], cx, y);
        } else {
          var cy = y;
          kids.forEach(function (cid) {
            place(cid, cx, cy);
            cy += subtreeH(cid) + GAP_Y;
          });
        }
      }

      function shiftTree(id, dx, dy) {
        if (!els[id] || nested[id]) return;
        if (dx) els[id].style.left = (parseFloat(els[id].style.left || 0) + dx) + "px";
        if (dy) els[id].style.top = (parseFloat(els[id].style.top || 0) + dy) + "px";
        stageKids(id).forEach(function (cid) { shiftTree(cid, dx, dy); });
      }

      function fitStage() {
        var maxR = 0, maxB = 0;
        Object.keys(els).forEach(function (id) {
          var el = els[id];
          maxR = Math.max(maxR, el.offsetLeft + el.offsetWidth);
          maxB = Math.max(maxB, el.offsetTop + el.offsetHeight);
        });
        stage.style.width = Math.ceil(maxR + PAD) + "px";
        stage.style.height = Math.ceil(maxB + PAD) + "px";
      }

      function inferCable(L) {
        if (L.cable) return L.cable;
        var ports = (L.fp || "") + " " + (L.tp || "");
        if (/can/i.test(ports)) return "can";
        if (/lock|dps/i.test(ports)) return "lock12";
        if (L.from === "flex" || L.to === "pw-follow" || /(entry|g3)$/.test(L.to)) return "cat6";
        return "cat6a";
      }

      var linkLabels = [];
      var linkEls = links.map(function (L, index) {
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("id", "topo-link-" + index);
        path.setAttribute("class", "topo-link cable-" + inferCable(L));
        path.setAttribute("data-from", L.from);
        path.setAttribute("data-to", L.to);
        path.setAttribute("data-from-port", L.fp);
        path.setAttribute("data-to-port", L.tp);
        path.setAttribute("data-info", L.info);
        if (L.route) path.setAttribute("data-route", L.route);
        svg.appendChild(path);
        if (L.label) {
          var label = document.createElementNS("http://www.w3.org/2000/svg", "text");
          label.setAttribute("class", "topo-link-label");
          label.textContent = L.label;
          var labelRoot = label;
          if (L.href) {
            var labelLink = document.createElementNS("http://www.w3.org/2000/svg", "a");
            labelLink.setAttribute("class", "topo-link-label-link");
            labelLink.setAttribute("href", L.href);
            labelLink.setAttribute("target", "_blank");
            labelLink.setAttribute("rel", "noopener noreferrer");
            labelLink.setAttribute("aria-label", L.label + " product page");
            labelLink.appendChild(label);
            labelRoot = labelLink;
          }
          svg.appendChild(labelRoot);
          linkLabels.push({ path: path, label: label, root: labelRoot });
        }
        return path;
      });
      /* Keep all labels above every cable path. */
      linkLabels.forEach(function (item) { svg.appendChild(item.root); });

      function pt(el, edgeSide) {
        var c = stage.getBoundingClientRect();
        var r = el.getBoundingClientRect();
        var x = r.left + r.width / 2 - c.left;
        var y = r.top + r.height / 2 - c.top;
        if (edgeSide === "right") x = r.right - c.left;
        if (edgeSide === "left") x = r.left - c.left;
        if (edgeSide === "bottom") y = r.bottom - c.top;
        if (edgeSide === "top") y = r.top - c.top;
        return { x: x, y: y };
      }

      function fromEdge(id) {
        return downsFaceDown(id) ? "bottom" : "right";
      }

      function toEdge(id) {
        return isTB(id) ? "top" : "left";
      }

      function treeBox(id) {
        var el = els[id];
        var top = parseFloat(el.style.top || 0);
        var left = parseFloat(el.style.left || 0);
        var bottom = top + el.offsetHeight;
        var right = left + el.offsetWidth;
        stageKids(id).forEach(function (cid) {
          var b = treeBox(cid);
          top = Math.min(top, b.top);
          bottom = Math.max(bottom, b.bottom);
          left = Math.min(left, b.left);
          right = Math.max(right, b.right);
        });
        return { top: top, bottom: bottom, left: left, right: right };
      }

      function separateSiblings(id) {
        var kids = stageKids(id);
        if (isHangFanout(id)) {
          for (var i = 1; i < kids.length; i++) {
            var needX = treeBox(kids[i - 1]).right + GAP_X - treeBox(kids[i]).left;
            if (needX > 0.4) shiftTree(kids[i], needX, 0);
          }
        } else {
          for (var i = 1; i < kids.length; i++) {
            var need = treeBox(kids[i - 1]).bottom + GAP_Y - treeBox(kids[i]).top;
            if (need > 0.4) shiftTree(kids[i], 0, need);
          }
        }
        kids.forEach(separateSiblings);
      }

      function portEl(id) {
        return id ? canvas.querySelector('[data-port="' + id + '"]') : null;
      }

      function linkIsVertical(fromId, toId) {
        if (!fromId) return false;
        if (downsFaceDown(fromId) && upsFaceUp(toId)) return true;
        return isTB(fromId) && isTB(toId);
      }

      function paintLinks() {
        fitStage();
        var w = stage.offsetWidth, h = stage.offsetHeight;
        svg.setAttribute("viewBox", "0 0 " + w + " " + h);
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
        linkEls.forEach(function (link) {
          var a = portEl(link.getAttribute("data-from-port"));
          var b = portEl(link.getAttribute("data-to-port"));
          if (!a || !b) return;
          var sc = pt(a);
          var ec = pt(b);
          var route = link.getAttribute("data-route");
          var vertical = route === "vertical" || (route !== "horizontal" && linkIsVertical(link.getAttribute("data-from"), link.getAttribute("data-to")));
          var s, e, d;
          if (vertical) {
            s = pt(a, sc.y <= ec.y ? "bottom" : "top");
            e = pt(b, sc.y <= ec.y ? "top" : "bottom");
            d = "M" + s.x + " " + s.y + " L" + s.x + " " + e.y;
          } else {
            s = pt(a, sc.x <= ec.x ? "right" : "left");
            e = pt(b, sc.x <= ec.x ? "left" : "right");
            if (Math.abs(s.y - e.y) > 1.5) {
              var midX = s.x + (e.x - s.x) / 2;
              d = "M" + s.x + " " + s.y + " L" + midX + " " + s.y + " L" + midX + " " + e.y + " L" + e.x + " " + e.y;
            } else {
              d = "M" + s.x + " " + s.y + " L" + e.x + " " + s.y;
            }
          }
          link.setAttribute("d", d);
          var linkLabel = null;
          for (var i = 0; i < linkLabels.length; i++) {
            if (linkLabels[i].path === link) {
              linkLabel = linkLabels[i].label;
              break;
            }
          }
          if (linkLabel) {
            var labelX = (s.x + e.x) / 2;
            if (vertical) labelX = s.x + linkLabel.getComputedTextLength() / 2 + 10;
            linkLabel.setAttribute("x", labelX);
            linkLabel.setAttribute("y", (s.y + e.y) / 2 + (vertical ? 0 : -11));
          }
        });
      }

      function clampOrigin() {
        var minX = Infinity, minY = Infinity;
        Object.keys(els).forEach(function (id) {
          if (nested[id]) return;
          minX = Math.min(minX, parseFloat(els[id].style.left || 0));
          minY = Math.min(minY, parseFloat(els[id].style.top || 0));
        });
        var dx = minX < PAD ? PAD - minX : 0;
        var dy = minY < PAD ? PAD - minY : 0;
        if (!dx && !dy) return;
        Object.keys(els).forEach(function (id) {
          if (nested[id]) return;
          if (dx) els[id].style.left = (parseFloat(els[id].style.left || 0) + dx) + "px";
          if (dy) els[id].style.top = (parseFloat(els[id].style.top || 0) + dy) + "px";
        });
      }

      function pinBackupPairs() {
        [
          ["drop-media-bak", "drop-media"],
          ["drop-den-bak", "drop-den"],
          ["drop-master-bak", "drop-master"],
          ["drop-br1-bak", "drop-br1"],
          ["drop-br2-bak", "drop-br2"],
          ["drop-seat-bak", "drop-seat"],
          ["drop-gar-bak", "drop-gar"]
        ].forEach(function (pair) {
          var bak = els[pair[0]];
          var act = els[pair[1]];
          if (!bak || !act) return;
          var dx = parseFloat(act.style.left || 0) + (act.offsetWidth - bak.offsetWidth) / 2 - parseFloat(bak.style.left || 0);
          var dy = parseFloat(act.style.top || 0) - bak.offsetHeight - 8 - parseFloat(bak.style.top || 0);
          if (Math.abs(dx) >= 0.4 || Math.abs(dy) >= 0.4) shiftTree(pair[0], dx, dy);
        });
      }

      function portCenterY(id) {
        var port = portEl(id);
        if (!port) return null;
        var rect = port.getBoundingClientRect();
        return rect.top + rect.height / 2;
      }

      function moveNodeOnly(id, dy) {
        if (!els[id] || Math.abs(dy) < 0.4) return;
        els[id].style.top = (parseFloat(els[id].style.top || 0) + dy) + "px";
      }

      function alignGarageUplink() {
        var flexY = portCenterY("flex-up");
        var dropY = portCenterY("drop-gar-flex");
        if (flexY == null || dropY == null) return;
        var dy = flexY - dropY;
        moveNodeOnly("drop-gar", dy);
        moveNodeOnly("drop-gar-bak", dy);
      }

      function alignMediaSwitchUplink() {
        var dropY = portCenterY("drop-media-dn");
        var switchY = portCenterY("media-flex-up");
        if (dropY == null || switchY == null) return;
        shiftTree("media-flex", 0, dropY - switchY);
      }

      function relayout() {
        subH = {};
        subW = {};
        measureNatural();
        stage.style.width = "1px";
        stage.style.height = "1px";
        placeDenseTopology();
        separateSiblings("flex");
        pinAllFanout();
        pinBackupPairs();
        alignGarageUplink();
        alignMediaSwitchUplink();
        balanceXgBranchExtents();
        pinXgPorts();
        clampOrigin();
        pinAllFanout();
        pinBackupPairs();
        alignGarageUplink();
        alignMediaSwitchUplink();
        pinXgPorts();
        paintLinks();
      }

      window.addEventListener("resize", function () {
        if (canvas.offsetWidth > 40) paintLinks();
      });
      window.relayoutTopo = relayout;
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () {
        if (canvas.offsetWidth > 40) relayout();
      });
      if (canvas.offsetWidth > 40) {
        relayout();
        setTimeout(relayout, 60);
      }
    })();

(function () {
      var sheet = document.getElementById("blueprint-sheet");
      var pageStyle = document.createElement("style");
      pageStyle.id = "print-page-size";

      function sourceFor(kind) {
        if (kind === "legend") return document.getElementById("legend-source");
        if (kind === "devices") return document.querySelector("#tab-devices .spa-main > table");
        if (kind === "topology") return document.querySelector("#topo-canvas .topo-stage");
        return null;
      }

      function clearTarget(target) {
        if (!target) return;
        target.innerHTML = "";
        target.style.left = "0px";
        target.style.top = "0px";
        target.style.transform = "none";
      }

      function stripCloneIds(root, preserveTopologyMarkers) {
        if (!root) return;
        root.removeAttribute("id");
        Array.prototype.forEach.call(root.querySelectorAll("[id]"), function (el) {
          if (!preserveTopologyMarkers || !/^topo-arrow-/.test(el.id)) el.removeAttribute("id");
        });
        Array.prototype.forEach.call(root.querySelectorAll("a, button"), function (el) {
          el.setAttribute("tabindex", "-1");
        });
      }

      function addBreakOpportunities(root) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        var node;
        while ((node = walker.nextNode())) {
          node.nodeValue = node.nodeValue.replace(/\//g, "/\u200b");
        }
      }

      function buildDevices() {
        var target = document.querySelector('[data-blueprint-target="devices"]');
        var source = sourceFor("devices");
        if (!target || !source) return;
        clearTarget(target);
        var clone = source.cloneNode(true);
        stripCloneIds(clone, false);
        clone.classList.add("blueprint-devices-table");
        Array.prototype.forEach.call(clone.querySelectorAll("tbody tr > td:last-child"), addBreakOpportunities);
        target.appendChild(clone);
      }

      function buildLegend() {
        var target = document.querySelector('[data-blueprint-target="legend"]');
        var source = sourceFor("legend");
        if (!target || !source) return;
        clearTarget(target);
        var clone = source.cloneNode(true);
        stripCloneIds(clone, false);
        clone.className = "blueprint-legend";
        target.appendChild(clone);
      }

      function cloneSource(kind) {
        var target = document.querySelector('[data-blueprint-target="' + kind + '"]');
        var source = sourceFor(kind);
        if (!target || !source) return;
        clearTarget(target);
        var clone = source.cloneNode(true);
        stripCloneIds(clone, kind === "topology");
        target.appendChild(clone);
      }

      function fitTarget(target) {
        var viewport = target && target.parentElement;
        var content = target && target.firstElementChild;
        if (!viewport || !content) return null;
        target.style.transform = "none";
        target.style.left = "0px";
        target.style.top = "0px";
        var viewportStyle = window.getComputedStyle(viewport);
        var padLeft = parseFloat(viewportStyle.paddingLeft) || 0;
        var padRight = parseFloat(viewportStyle.paddingRight) || 0;
        var padTop = parseFloat(viewportStyle.paddingTop) || 0;
        var padBottom = parseFloat(viewportStyle.paddingBottom) || 0;
        var availableWidth = Math.max(1, viewport.clientWidth - padLeft - padRight);
        var availableHeight = Math.max(1, viewport.clientHeight - padTop - padBottom);
        var width = Math.max(content.scrollWidth, content.offsetWidth, 1);
        var height = Math.max(content.scrollHeight, content.offsetHeight, 1);
        var scale = Math.min(availableWidth / width, availableHeight / height);
        if (!isFinite(scale) || scale <= 0) return null;
        return {
          target: target,
          viewport: viewport,
          width: width,
          height: height,
          fit: scale,
          padLeft: padLeft,
          padTop: padTop,
          availableWidth: availableWidth,
          availableHeight: availableHeight
        };
      }

      function fitBlueprint() {
        if (!sheet) return;
        var measured = [];
        Array.prototype.forEach.call(sheet.querySelectorAll(".blueprint-scale"), function (target) {
          var item = fitTarget(target);
          if (item) measured.push(item);
        });
        if (!measured.length) return;
        var commonScale = measured.reduce(function (smallest, item) {
          return Math.min(smallest, item.fit);
        }, Infinity);
        measured.forEach(function (item) {
          item.target.style.transform = "scale(" + commonScale + ")";
          item.target.style.left = item.padLeft + Math.max(0, (item.availableWidth - item.width * commonScale) / 2) + "px";
          item.target.style.top = item.padTop + "px";
        });
      }

      function renderBlueprint(done) {
        if (!sheet) return;
        document.body.classList.add("blueprint-source-measure");
        requestAnimationFrame(function () {
          if (typeof window.relayoutTopo === "function") window.relayoutTopo();
          requestAnimationFrame(function () {
            buildDevices();
            buildLegend();
            cloneSource("topology");
            document.body.classList.remove("blueprint-source-measure");
            requestAnimationFrame(function () {
              fitBlueprint();
              if (done) done();
            });
          });
        });
      }

      function clearPrintMode() {
        document.body.classList.remove("print-blueprint", "print-design");
        if (pageStyle.parentNode) pageStyle.parentNode.removeChild(pageStyle);
      }

      function exportPDF(mode) {
        clearPrintMode();
        document.body.classList.add(mode === "blueprint" ? "print-blueprint" : "print-design");
        pageStyle.textContent = mode === "blueprint"
          ? "@page { size: 36in 24in; margin: 0.3in 0.4in; }"
          : "@page { size: 8.5in 11in; margin: 0.55in; }";
        document.head.appendChild(pageStyle);
        if (mode === "blueprint") {
          renderBlueprint(function () { setTimeout(function () { window.print(); }, 80); });
        } else {
          setTimeout(function () { window.print(); }, 30);
        }
      }

      var blueprintButton = document.getElementById("export-blueprint-pdf");
      var designButton = document.getElementById("export-design-pdf");
      if (blueprintButton) blueprintButton.addEventListener("click", function () { exportPDF("blueprint"); });
      if (designButton) designButton.addEventListener("click", function () { exportPDF("design"); });

      window.addEventListener("beforeprint", function () {
        if (document.body.classList.contains("print-blueprint")) fitBlueprint();
      });
      window.addEventListener("afterprint", function () {
        clearPrintMode();
        if (location.hash === "#blueprint") renderBlueprint();
      });
      window.addEventListener("resize", function () {
        if (location.hash === "#blueprint") fitBlueprint();
      });

      window.renderBlueprint = renderBlueprint;
    })();

(function () {
      var tabs = document.querySelectorAll(".spa-tab");
      var buttons = document.querySelectorAll(".spa-nav button[data-tab]");
      var src = document.getElementById("legend-source");
      var dst = document.getElementById("legend-topo");
      if (src && dst && !dst.childNodes.length) dst.innerHTML = src.innerHTML;

      function show(id) {
        var key = id || "devices";
        Array.prototype.forEach.call(tabs, function (t) {
          t.classList.toggle("is-on", t.getAttribute("data-tab") === key);
        });
        Array.prototype.forEach.call(buttons, function (b) {
          b.classList.toggle("is-on", b.getAttribute("data-tab") === key);
        });
        if (history.replaceState) history.replaceState(null, "", "#" + key);
        if (key === "topology" && typeof window.relayoutTopo === "function") {
          requestAnimationFrame(function () {
            window.relayoutTopo();
            setTimeout(window.relayoutTopo, 60);
          });
        }
        if (key === "blueprint" && typeof window.renderBlueprint === "function") {
          window.renderBlueprint();
        }
      }

      Array.prototype.forEach.call(buttons, function (b) {
        b.addEventListener("click", function () { show(b.getAttribute("data-tab")); });
      });

      var initial = (location.hash || "").replace("#", "");
      if (initial === "topo") initial = "topology";
      if (initial === "blueprint2") initial = "blueprint";
      show(initial || "devices");
    })();
})();