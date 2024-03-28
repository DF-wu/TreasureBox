#!/bin/bash

# Colors
GREEN='\e[32m'
RED='\e[31m'
YELLOW='\e[33m'
BLUE='\e[34m'
NC='\e[0m' # No Color
BOLD='\e[1m'
UNDERLINE='\e[4m'
NORMAL='\e[0m'

ERRORS=""

# make sure that docker is running
DOCKER_INFO_OUTPUT=$(docker info 2> /dev/null | grep "Containers:" | awk '{print $1}')

if [ "$DOCKER_INFO_OUTPUT" == "Containers:" ]
  then
    echo -e "${GREEN}Docker is running, so we can continue${NC}"
  else
    echo -e "${RED}Docker is not running, exiting${NC}"
    exit 1
fi

# get a list of docker images that are currently installed
IMAGES_WITH_TAGS=$(docker images | grep -v REPOSITORY | grep -v TAG | grep -v "<none>" | awk '{printf("%s:%s\n", $1, $2)}')

# run docker pull on all of the images
for IMAGE in $IMAGES_WITH_TAGS; do
  echo "*****"

  echo -e "Updating ${GREEN}${BOLD}${UNDERLINE}$IMAGE${NC}${NORMAL}"

  OUTPUT=$(docker pull $IMAGE 2>&1)

  echo -e "${YELLOW}$OUTPUT${NC}"

  ERROR=$(echo -e $OUTPUT | grep "Error")

  # if grep returns 0 (found some)
  if [ $? == 0 ]; then
      echo -e "${RED}${BOLD}Error: Update $IMAGE failed${NORMAL}${NC}"
      ERRORS+="$IMAGE -> $ERROR\n"
  fi
  echo "*****"
  echo
done

# did everything finish correctly? Then we can exit
if [ ! -z "$ERRORS" ]; then
  echo -e "${RED}${BOLD}Finished with Errors:\n$ERRORS"
  exit 1
else
  echo -e "${GREEN}${BOLD}Docker images are now up to date${NC}${NORMAL}"
  exit 0
fi
