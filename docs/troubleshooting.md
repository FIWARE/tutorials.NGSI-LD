# Troubleshooting

## Handling Docker Volume Errors

When encountering issues with creating or running containers due to old volumes that could not be deleted properly, try
running the following commands:

1.  List the existing Docker volumes using the following command: `docker volume ls`

2.  Before deleting the old volumes, stop the container(s) using the following command: `docker-compose down`
    (alternatively try `./services stop`)

3.  Remove the all the old volumes using the following command: `docker volume prune `

    Options may be added to this last command:

    `--filter` filter : Provide filter values (e.g. `label=<label>`) `--force` , `-f` : Do not prompt for confirmation

    If the response indicated _"Total reclaimed space: 0B"_ and the old volumes are not removed as expected, try
    restarting docker.

## Deleting Networks

When running the tutorial using the command `./services` start, you might encounter an issue with deleting an old
network. In such cases, you can attempt to delete the network using the following command:

```bash
docker network prune
```

However,it may not work if a running container is still attached to a network. To check the existing networks use the
following command:

```bash
docker network ls
```

To resolve this, you can stop the running containers using the following command:

```bash
docker stop $(docker ps -a -q)
```

This will allow you to proceed with network pruning and ensure a smooth execution of the tutorial.

Additionally you can remove the all hanging container resources: `docker system prune`

## Handling "Request Timed Out" Error

During the tutorials, the error message _"request timed out"_ can sometimes be encountered when making HTTP requests.
This error typically occurs when the HTTP client is unable to receive a response from the server within a specified time
limit. One common cause of this issue is a slow network connection. In this case, try the following solutions:

-   Retry the request because the timeout may be temporary due to network fluctuations.
-   Check the network connection.

## Managing Insufficient Space in Ubuntu VM

Users operating Ubuntu on a virtual machine may encounter the warning _"Low Disk Space on 'Filesystem root'. The volume
'Filesystem root' has only 0GB disk space remaining"_, particularly when running resource-intensive tutorials (such as
301 and 302). If you face this issue, you can consider the following options:

-   Increase your disk size in VirtualBox.
-   Create a new virtual machine in VirtualBox (Note: With this option, the new VM will not have access to the data
    saved on your previous VM).
-   Run the tutorials on [Gitpod](https://github.com/gitpod-io/gitpod). This cloud-based environment does not consume
    your local resources.

## WSL Setup with WSL Ubuntu-22.04 (Windows 11) for NGSI-LD SMART FARM Tutorials

Using WSL Ubuntu-22.04 to run the NGSI-LD SMART FARM Tutorials.

-   To install WSL on Windows follow the instructions [here](https://learn.microsoft.com/en-us/windows/wsl/install)
-   Install the terminal Ubuntu-22.04.3 LTS from Microsoft Store
-   Open command prompt and set the default WSL to the newly installed Ubuntu-22.04.3 LTS - list all wls to ensure
    Ubuntu-22.04 is part of the list ` wsl.exe -l ` - Set Ubuntu-22.04 to default ` wsl.exe --set-default Ubuntu-22.04 `
-   Ensure docker desktop is running, open Settings > General, enable WSL 2 based engine
-   Open start menu, search for Ubuntu-22.04.3 LTS, and run it.
-   Install Docker on the terminal following the instructions
    [here](https://ngsi-ld-tutorials.readthedocs.io/en/latest/docker-ubuntu.html)
-   On the terminal, follow the instructions here https://github.com/FIWARE/tutorials.NGSI-LD
-   `cd` to any tutorials folder (ex. tutorials.Getting-Started)
-   If error on `./services` command , prefix with `sudo` command.

-   Setup Postman and import postman a tutorial file (ex. tutorials.NGSI-LD\tutorials.Getting-Started\FIWARE Working
    with @context.postman_collection.json)

  ## When trying to run any of the ./services produces "cannot execute: required file not found"

This may be caused by a character encoding problem in the services script if e.g. the repository has been cloned on Windows, while the script is being run in a Linux/WSL terminal. 

Running the "dos2linux" command may work, but a more solid solution in this case is to clone the repository directly in the Linux/WSL terminal.
