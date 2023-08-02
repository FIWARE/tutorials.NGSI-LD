# Troubleshooting

## Handling Docker Errors

When encountering issues with creating or running containers due to old volumes that could not be deleted properly, try
running the following commands:

1.  List the existing Docker volumes using the following command: `docker volume ls`

2.  Before deleting the old volumes, stop the container(s) using the following command: `docker-compose down` (alternatively try `./services stop`)

3.  Remove the all the old volumes using the following command: `docker volume prune `

    Options may be added to this last command:

    `--filter` filter : Provide filter values (e.g. `label=<label>`) `--force` , `-f` : Do not prompt for confirmation

    If the response indicated _"Total reclaimed space: 0B"_ and the old volumes are not removed as expected, try restarting
    docker.

4.  Remove the all the old networks using the following command: `docker network prune `
5.  Remove all hanging container resources: `docker system prune`

## Handling "Request Timed Out" Error

During the tutorials, the error message _"request timed out"_ can sometimes be encountered when making HTTP requests.
This error typically occurs when the HTTP client is unable to receive a response from the server within a specified time
limit. One common cause of this issue is a slow network connection. In this case, try the following solutions:

-   Retry the request because the timeout may be temporary due to network fluctuations.
-   Check the network connection.
