# Manual test VM

Run from PowerShell on Windows; requires `ssh`, `scp`, and `tar` in PATH.
Docker commands run only on the VM. No local Python or Node installation is needed.

```powershell
.\scripts\vm.ps1 start
.\scripts\vm.ps1 status
.\scripts\vm.ps1 logs
.\scripts\vm.ps1 stop
```

`start` uploads the current local backend/frontend into a separate release directory,
builds an image, stops the old application before startup migrations, and waits for
MySQL and the application to become healthy. A failed build leaves the old application
running. If startup fails, inspect `logs`; the old application is not automatically
restarted against a potentially migrated schema. An interrupted SSH command can leave
an incomplete deployment; use `status`/`logs`, then repeat `start` as needed.

Default address: http://dockervm:8080. Initial test login: `admin` / `TicketTest2026!`.
The first initialization creates four demo events and 512 tickets. Updates keep
existing data and passwords; deleting all events does not trigger demo seeding again.
`stop` stops only the project's containers; it keeps volumes, images, release files,
and the VM itself. Release directories are retained for inspection.

The defaults reuse the manual test database created on 25 October 2026.
To create an independent test stand, supply a different project name and directory
(port 8080 must be free):

```powershell
.\scripts\vm.ps1 start -Vm dockervm -Project ticketsystem-other -RemoteDirectory projects/ticketsystem-other
.\scripts\vm.ps1 stop -Vm dockervm -Project ticketsystem-other
```

This is a local-network test configuration with fixed test passwords and HTTP cookies.
Camera access for the QR scanner requires HTTPS or a localhost SSH tunnel.
