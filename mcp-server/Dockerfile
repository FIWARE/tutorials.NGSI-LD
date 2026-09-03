ARG NODE_VERSION=20
ARG DISTROLESS_NODE_VERSION=nodejs20-debian12
ARG GITHUB_ACCOUNT=fiware
ARG GITHUB_REPOSITORY=tutorials.NGSI-LD
ARG DOWNLOAD=latest
ARG SOURCE_BRANCH=master
ARG SOURCE_COMMIT=unknown

########################################################################################
#
# This build stage retrieves the source code from GitHub. The default download is the
# latest tip of the master of the named repository on GitHub.
#
# To obtain the latest stable release run this Docker file with the parameters:
# --no-cache --build-arg DOWNLOAD=stable
#
# To obtain any specific version of a release run this Docker file with the parameters:
# --no-cache --build-arg DOWNLOAD=1.7.0
#
# For development purposes, to create a development image including a running Distro,
# run this Docker file with the parameter:
#
# --target=builder
#
########################################################################################
FROM node:${NODE_VERSION} AS builder
ARG GITHUB_ACCOUNT
ARG GITHUB_REPOSITORY
ARG DOWNLOAD
ARG SOURCE_BRANCH

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# As an alternative for local development, just copy this Dockerfile into the root of
# the repository and replace the whole RUN statement below by the following COPY
# statement using your local source:
#
# COPY ./mcp-server /opt/mcp-server
#

# hadolint ignore=DL3008
RUN \
  # Ensure that unzip is installed prior to downloading
  apt-get install -y --no-install-recommends unzip && \
  if [ "${DOWNLOAD}" = "latest" ] ; \
  then \
    RELEASE="${SOURCE_BRANCH}"; \
    echo "INFO: Building Latest Development from ${SOURCE_BRANCH} branch."; \
  elif [ "${DOWNLOAD}" = "stable" ]; \
  then \
    RELEASE=$(curl -s https://api.github.com/repos/"${GITHUB_ACCOUNT}"/"${GITHUB_REPOSITORY}"/releases/latest | grep 'tag_name' | cut -d\" -f4); \
    echo "INFO: Building Latest Stable Release: ${RELEASE}"; \
  else \
    RELEASE="${DOWNLOAD}"; \
    echo "INFO: Building Release: ${RELEASE}"; \
  fi && \
  RELEASE_CONCAT=$(echo "${RELEASE}" | tr / -); \
  curl -s -L https://github.com/"${GITHUB_ACCOUNT}"/"${GITHUB_REPOSITORY}"/archive/"${RELEASE}".zip > source.zip && \
  unzip -qq source.zip -x "*/docs/**" "*/.*" && \
  rm source.zip && \
  mv "${GITHUB_REPOSITORY}-${RELEASE_CONCAT}/mcp-server" /opt/mcp-server && \
  # Remove unzip and clean apt cache
  apt-get clean && \
  apt-get remove -y unzip && \
  apt-get -y autoremove && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /opt/mcp-server

RUN \
  echo "INFO: npm install..." && \
  npm install --no-package-lock --no-optional && \
  npm run build && \
  npm prune --omit=dev

USER node
ENV NODE_ENV=development
ENV MCP_TRANSPORT=http
# Mount a directory of Smart Data Models schema.json files here (with a common/
# subdir for offline $ref resolution). Empty/absent => generic + context-discovery
# tools only. The NGSI-LD context-discovery response schemas are bundled in the image.
ENV SCHEMA_DIR=/schemas
VOLUME ["/schemas"]
# Port used by the HTTP-stream MCP transport
EXPOSE 3000
CMD ["node", "/opt/mcp-server/dist/bin/www.js"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
   CMD ["npm", "run", "healthcheck"]

########################################################################################
#
# This build stage creates an anonymous user to be used with the distroless build
# as defined below.
#
########################################################################################
FROM node:${NODE_VERSION} AS anon-user
RUN sed -i -r "/^(root|nobody)/!d" /etc/passwd /etc/shadow /etc/group \
    && sed -i -r 's#^(.*):[^:]*$#\1:/sbin/nologin#' /etc/passwd


#
# The following creates a distroless build for production.
#

# hadolint ignore=DL3006
FROM gcr.io/distroless/${DISTROLESS_NODE_VERSION}
ARG TARGET
ARG GITHUB_ACCOUNT
ARG GITHUB_REPOSITORY
ARG NODE_VERSION
ARG SOURCE_COMMIT
ENV GIT_COMMIT=$SOURCE_COMMIT

LABEL "maintainer"="FIWARE Foundation <fiware.eu@gmail.com>"
LABEL "org.opencontainers.image.authors"="https://www.fiware.org/contact-us/"
LABEL "org.opencontainers.image.documentation"="http://fiware-tutorials.rtfd.io/"
LABEL "org.opencontainers.image.vendor"="FIWARE Foundation"
LABEL "org.opencontainers.image.licenses"="MIT"
LABEL "org.opencontainers.image.title"="NGSI-LD MCP Server"
LABEL "org.opencontainers.image.description"="Model Context Protocol server exposing an NGSI-LD Context Broker to LLM agents"
LABEL "org.opencontainers.image.source"=https://github.com/${GITHUB_ACCOUNT}/${GITHUB_REPOSITORY}
LABEL "org.nodejs.version"=${NODE_VERSION}

COPY --from=builder /opt/mcp-server /opt/mcp-server
WORKDIR /opt/mcp-server

USER nobody
ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV SCHEMA_DIR=/schemas
VOLUME ["/schemas"]
# Port used by the HTTP-stream MCP transport
EXPOSE 3000
CMD ["./dist/bin/www.js"]
HEALTHCHECK  --interval=30s --timeout=3s --start-period=10s \
  CMD ["/nodejs/bin/node", "./dist/bin/healthcheck.js"]
