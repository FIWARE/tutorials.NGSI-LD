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
