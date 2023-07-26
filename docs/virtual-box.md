

# Virtual Box Setup

Windows and Mac are able to emulate a Unix system when running [VirtualBox](https://www.virtualbox.org/) - the following minimal set-up is recommended:

-   VirtualBox
-   Ubuntu 22.04.2 2G RAM 25G Disk
-   Docker Engine on Ubuntu: Docker 24.0.4 and Docker compose 2.19.1

Download Virtualbox from [here](https://www.virtualbox.org/)

## Ubuntu

Download Ubuntu LTS from [here](https://ubuntu.com/download/desktop)

To set up the working environment, follow these steps:
-   Open Virtualbox and create a new virtual machine.
-   Select the ISO image downloaded earlier (`.iso` file).
-   Choose a username and a password. Check the "Guest Additions" option (to enable features such as shared clipboard and shared folders).
-   Set the memory size to 2GB and allocate 2 CPUs.
-   Create a virtual hard disk with a size of 25GB.
-   Finish the setup process and start the virtual machine.

If you encounter the error _"Username is not in the sudoers file. This incident will be reported"_ when attempting to execute a `sudo` command, follow these steps to resolve the issue:

-   Restart your virtual machine. While restaring, press the Shift key for a few seconds to get the Grub boot menu.
-   Using the Down Arrow, select "Advanced options for Ubuntu" and press Enter.
-   Select the kernel with the "recovery mode" option and press Enter to open the Recovery menu.
-   In the "Recovery menu", move over to the line "root Drop to root shell prompt", then press Enter.
-   Use the root password and press Enter to start the "maintenance mode".
-   At this point, you should be at the root shell prompt. Change the system to be mounted as read/write by running the command: `mount -o rw,remount /`
-   Execute the following command to add the user to the sudo group: "adduser username sudo" (use the actual username on the system).
-   Type the exit command to go back to the "Recovery menu": "Exit"
-   Use the Right Arrow to select `<Ok>` and press Enter.
-   Press `<Ok>` to continue with normal boot sequence.
