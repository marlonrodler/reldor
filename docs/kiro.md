<p align="center"><strong>English</strong> · <a href="./kiro.pt-BR.md">Português</a></p>

# Adding Reldor to Kiro, step by step

In Kiro, a plugin is called a **power**. Installing the Reldor power teaches Kiro's agent to use Reldor: after that, you talk and it runs the commands.

Before you start, the `reldor` command must already be installed (step 2 of the [README](../README.md#2-install-the-reldor-command)). The power only teaches the AI; the command does the work.

There are two ways. Use **A** if the Reldor repository is public. If it is private, use **B**.

## A. From the GitHub link

1. Open Kiro.
2. On the left icon bar, click the **Kiro ghost icon with a lightning bolt** ⚡. The **Powers** panel opens.
3. In the panel, click **Add Custom Power**.
4. A list of options shows up. Click **Import power from GitHub**.
5. A text box shows up. Paste this link, exactly:
   ```
   https://github.com/marlonrodler/reldor/tree/main/plugins/kiro/reldor
   ```
   Note that it ends in `plugins/kiro/reldor`. If you paste only `https://github.com/marlonrodler/reldor`, Kiro does not find the power.
6. Click **Install**.
7. **reldor** shows up in the list of installed powers. Done.

**To update** when a new version comes out: in the Powers panel, click **reldor**, then **Check for updates** and, if there are any, **Install updates**.

## B. From a folder on your computer (private repository)

Kiro cannot reach a private repository from the link. So you download Reldor into a folder and point Kiro at it.

**1. Download Reldor into a folder of yours** (once). In PowerShell:

```powershell
mkdir C:\Users\$env:USERNAME\tools
cd C:\Users\$env:USERNAME\tools
git clone https://github.com/marlonrodler/reldor.git
```

Now the folder `C:\Users\<you>\tools\reldor` exists. Don't use a OneDrive folder.

**2. Import it in Kiro:**

1. Open Kiro and click the **ghost icon with a lightning bolt** ⚡ on the left bar. The **Powers** panel opens.
2. Click **Add Custom Power**.
3. Click **Import power from a folder**.
4. The Windows folder picker opens. Go to:
   ```
   C:\Users\<you>\tools\reldor\plugins\kiro\reldor
   ```
   Go **all the way to the last `reldor` folder**, the one with the `plugin.json` file and the `skills` folder inside. If you pick the first `reldor` folder (the top one), Kiro does not find the power.
5. Click **Select Folder**, then **Install**.
6. **reldor** shows up in the list of installed powers. Done.

**To update** when a new version comes out:

```powershell
cd C:\Users\$env:USERNAME\tools\reldor
git pull
```

Then repeat the import (steps 1 to 5).

## Check that it works

1. In Kiro, open your Salesforce project folder (**File → Open Folder**).
2. Open a **new chat** in Kiro. A chat opened before the install does not know the power.
3. Type: **I want to use Reldor**.
4. Kiro should run `reldor status` and tell you where you are, or start setting up the project.

You can also click **Try the power** in the Powers panel: Kiro opens a chat with Reldor already active.

## Something went wrong?

- **I can't find the ghost icon with a lightning bolt.** It is on the vertical icon bar on the left, with the file explorer and search. If it is not there, update Kiro: powers came in the newer versions.
- **"Import power from GitHub" failed.** Check that the link ends in `plugins/kiro/reldor`. If the repository is private, use way B.
- **"Import power from a folder" did not accept the folder.** It is the wrong folder. The right one has `plugin.json` inside: `...\reldor\plugins\kiro\reldor`.
- **The AI says it doesn't know Reldor.** Open a new chat. If it persists, check that **reldor** is in the Powers panel list.
- **The AI knows Reldor, but the command fails.** The `reldor` command is missing on the computer. In a terminal, run `reldor doctor`. If it is not recognized, go back to step 2 of the README.
