#!/bin/bash

# Author: df
# Date: 2024-03-28
# Description: Update all docker images on the server by watchowner

docker pull
docker run --rm   --name watchtower     --volume /var/run/docker.sock:/var/run/docker.sock     containrrr/watchtower --run-once 
