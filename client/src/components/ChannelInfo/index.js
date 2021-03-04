import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Tabs,
  Tab,
  Typography,
  Box,
  Grid,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Slide,
} from "@material-ui/core";
import Cookies from "js-cookie";
import axios from "axios";
import { githubApiDomain, rcApiDomain } from "../../utils/constants";
import online from "../../images/online.png";

import "./index.css";

const Transition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`channelinfo-tabpanel-${index}`}
      aria-labelledby={`channelinfo-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box style={{ padding: "15px 20px 0px 20px" }}>
          <Typography component={"span"}>{children}</Typography>
        </Box>
      )}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.any.isRequired,
  value: PropTypes.any.isRequired,
};

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

export default function ChannelInfo(props) {
  const [repoInfo, setRepoInfo] = useState({});
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoggedOut, setIsLoggedOut] = useState(false);
  const [channelMembers, setChannelMembers] = useState([]);
  const [openMembersDialog, setOpenMembersDialog] = useState(false);
  const [value, setValue] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const repoURL = `https://github.com/${props.location.pathname
    .split("/")[2]
    .replace("_", "/")}`;

  useEffect(() => {
    const ghRepoInfo = async () => {
      try {
        // Fetches repository information
        const repository = props.location.pathname
          .split("/")[2]
          .replace("_", "/");
        const ghHeaders = {
          accept: "application/json",
        };
        if (Cookies.get("gh_private_repo_token")) {
          ghHeaders["Authorization"] = `token ${Cookies.get(
            "gh_private_repo_token"
          )}`;
        }
        const ghRepoInfoResponse = await axios({
          method: "get",
          url: `${githubApiDomain}/repos/${repository}`,
          headers: ghHeaders,
        });
        setRepoInfo(ghRepoInfoResponse.data);
      } catch (error) {
        console.log(error);
        setIsPrivate(true);
      }
    };

    const channelMembers = async () => {
      try {
        // Fetches channel members
        const channelMembersResponse = await axios({
          method: "get",
          url: `${rcApiDomain}/api/v1/channels.members`,
          headers: {
            "X-Auth-Token": Cookies.get("rc_token"),
            "X-User-Id": Cookies.get("rc_uid"),
          },
          params: {
            roomName: props.location.pathname.split("/")[2],
          },
        });
        setChannelMembers(channelMembersResponse.data.members);
      } catch (error) {
        console.log(error);
        setIsLoggedOut(true);
      }
    };
    ghRepoInfo();
    channelMembers();
  }, [props.location.pathname]);

  const handleChange = (event, newValue) => {
    setValue(newValue);
    setActiveTab(newValue);
  };

  const handleCloseMembersDialog = () => {
    setOpenMembersDialog(false);
  };

  return (
    <div>
      <Tabs
        value={value}
        onChange={handleChange}
        aria-label="simple tabs example"
        indicatorColor="none"
      >
        <Tab
          className="channel-info-tab"
          style={{
            color: activeTab == 0 ? "#9a9ea4" : "#70747b",
          }}
          label="People"
          {...a11yProps(0)}
        />
        <Tab
          className="channel-info-tab"
          style={{
            color: activeTab == 1 ? "#9a9ea4" : "#70747b",
          }}
          label="Repo Info"
          {...a11yProps(1)}
        />
      </Tabs>
      <TabPanel value={value} index={0}>
        <div className="channel-info-wrapper">
          {!isLoggedOut ? (
            <>
              <Grid container spacing={2} style={{ marginBottom: "20px" }}>
                {channelMembers
                  .filter(
                    (user, index) => user.status === "online" && index <= 25
                  )
                  .map((user) => {
                    return (
                      <Grid
                        key={user.username}
                        item
                        xs={2}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          position: "relative",
                        }}
                      >
                        <img
                          style={{
                            width: "10px",
                            height: "10px",
                            zIndex: "2",
                            position: "absolute",
                          }}
                          src={online}
                        />
                        <img
                          style={{
                            width: "30px",
                            zIndex: "1",
                            marginLeft: "5px",
                          }}
                          src={`${rcApiDomain}/avatar/${user.username}`}
                        />
                      </Grid>
                    );
                  })}
              </Grid>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => setOpenMembersDialog(true)}
              >
                See All
              </Button>
            </>
          ) : (
            <div className="user-logged-out-message">
              Please sign in to view this information.
            </div>
          )}
        </div>
      </TabPanel>
      <TabPanel value={value} index={1}>
        <div className="repo-info-wrapper">
          {!isPrivate ? (
            <>
              <div className="repo-info-header">
                <span>{repoInfo.name} </span>
              </div>
              <div className="repo-info-description">
                <div>
                  <span>{repoInfo.description}</span>
                </div>
                <div>
                  <span>
                    <i>{repoInfo.language}</i>
                  </span>
                </div>
                <div style={{ marginTop: "10px" }}>
                  <span>by {repoInfo.owner ? repoInfo.owner.login : ""}</span>
                </div>
              </div>

              <div className="repo-info-stats">
                <span>
                  <a href={`${repoURL}/issues`}>
                    <strong>{repoInfo.open_issues_count}</strong> issues
                  </a>
                </span>
                <span>
                  <a href={`${repoURL}/watchers`}>
                    <strong>{repoInfo.watchers_count}</strong> watchers
                  </a>
                </span>
                <span>
                  <a href={`${repoURL}/stargazers`}>
                    <strong>{repoInfo.stargazers_count}</strong> stars
                  </a>
                </span>
              </div>
            </>
          ) : (
            <div className="private-repo-message">
              It looks like you don't have the right permissions to view
              information about this repository.
            </div>
          )}
        </div>
      </TabPanel>
      <Dialog
        open={openMembersDialog}
        keepMounted
        onClose={handleCloseMembersDialog}
        aria-labelledby="alert-dialog-slide-title"
        aria-describedby="alert-dialog-slide-description"
        TransitionComponent={Transition}
        maxWidth="sm"
        fullWidth={true}
        scroll="paper"
      >
        <DialogTitle>Channel Members</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} style={{ margin: "10px 0px" }}>
            {channelMembers.map((user) => {
              return (
                <Grid
                  key={user.username}
                  item
                  md={4}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    position: "relative",
                  }}
                >
                  <img
                    style={{ width: "30px" }}
                    src={`${rcApiDomain}/avatar/${user.username}`}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      marginLeft: "5px",
                    }}
                  >
                    <span style={{ fontWeight: "bold" }}>{user.name}</span>
                    <span style={{ fontSize: "x-small" }}>
                      @{user.username}
                    </span>
                  </div>
                </Grid>
              );
            })}
          </Grid>
        </DialogContent>
      </Dialog>
    </div>
  );
}
