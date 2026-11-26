# USAtlas

USAtlas is an interactive atlas of U.S. Census geography and facts. [Open the public atlas](https://erikedavis.github.io/RTS-USA-Atlas/) on a computer or phone. The release version appears beside Search.

## Run a local preview on Windows

Install Python 3. Clone the repository or extract a complete [release package](https://github.com/erikedavis/RTS-USA-Atlas/releases/latest). Run **Start_Atlas.cmd** from that folder to open the desktop preview on port **8020**. The configured Windows PC can also use the shared **Start USA Atlas** shortcut.

For a local phone preview, connect the PC and phone to the same Wi-Fi. Run **Start_Phone_Preview.cmd**, leave its window open, and enter the address it prints in your phone's browser. The default port is **8019**. The public atlas works on any internet connection without these launchers.

## Releases and reference

GitHub Pages serves the latest deployed numbered release. Push a tag such as **V1.0A** or **V2.0A** on the verified release commit to publish. A normal branch push runs the applicable QA workflow. Development previews stay local.

[Development handoff](HANDOFF.md) · [QA guide](QA_START_HERE.md) · [Data and source notes](documentation/DATA_QA.md)
