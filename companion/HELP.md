# Synesthesia Pro

This module sends documented OSC commands to Synesthesia Pro and can listen for scene and global-control state. OSC is available only with a Synesthesia Pro license. Synesthesia's OSC API is still evolving, so confirm routes against the [current Synesthesia OSC manual](https://synesthesia.live/docs/manual/osc.html) if behavior changes after an update.

## Suggested same-computer setup

The module defaults match Synesthesia's displayed OSC defaults: input port `6000` and output port `7000`. Any available UDP ports work when both applications use the same mapping.

| Direction | Sender                 | Receiver                    | Suggested destination |
| --------- | ---------------------- | --------------------------- | --------------------- |
| Control   | Companion              | Synesthesia OSC Input       | `127.0.0.1:6000`      |
| State     | Synesthesia OSC Output | Companion feedback listener | `127.0.0.1:7000`      |

1. In Synesthesia, open Settings and find OSC.
2. Enable **Input** and set **Input Port** to `6000`.
3. In the Companion connection, set **Synesthesia host or IP** to `127.0.0.1` and **Synesthesia OSC input port** to `6000`.
4. To receive state, enable **Output** in Synesthesia. Set **Output Address** to `127.0.0.1` and **Output Port** to `7000`.
5. In Companion, enable **Listen for OSC feedback**, use local listen address `0.0.0.0`, and set the listen port to `7000`.
6. In Synesthesia, choose **Global Addresses** and **Output Normalized Values**. In Companion, choose the matching **Normalized (0 to 1)** expectation.
7. Leave Synesthesia's audio-variable output disabled. It is high-volume and this module does not process it.

`0.0.0.0` is a Companion bind address, not a destination to enter in Synesthesia. Use `127.0.0.1` as the Synesthesia output destination when both applications run on the same computer.

## Remote LAN setup

Set the Companion target host to the LAN address of the Synesthesia computer. Set Synesthesia's OSC Output Address to the LAN address of the Companion computer. Keep the input and output port pairs matched and allow the selected UDP ports through both operating-system firewalls. Bind Companion to `0.0.0.0` or the specific local interface address that should receive feedback.

OSC uses UDP. **Listener Ready** confirms that Companion opened its local UDP socket. **Feedback Recently Received** confirms that Synesthesia sent at least one supported scene or global-control message within the configured freshness timeout. These indicators intentionally describe local listener state and recent feedback activity separately.

## Dynamic global controls and a rotary

Synesthesia reports 16 names for each global control type when a scene launches. Empty name messages clear unused positions. This lets one physical control follow the first slider in every scene:

1. Add the **Global Slider 1 Rotary** preset to a Stream Deck encoder.
2. The left and right turns use **Global Scalar: Adjust Relative** with a normalized step of `0.05`.
3. The LCD text uses:

   ```text
   $(Synesthesia:global_slider_1_name)
   $(Synesthesia:global_slider_1_value)
   ```

4. Launch a scene in Synesthesia. If its first slider is named `separation`, the LCD shows that name and its current normalized value.
5. Launch another scene. Synesthesia sends a new `/controls/global/slider/1/name` message, so the same encoder and LCD automatically follow that scene's first slider.

The preset assumes the Companion connection label is `Synesthesia`. If you rename the connection, select the variables again or replace that label in the button text.

Dynamic surface rotaries use the last inbound normalized value and stay blank until one arrives; they do not invent a starting number. Raw feedback mode cannot safely drive unknown-range relative sliders. When Synesthesia labels known 0-to-1 toggle or RGB output with `/raw` despite the normalized-output setting, the module accepts those unambiguous values while retaining the `feedback_detected_mode` and `feedback_mode_mismatch` diagnostics.

XY values are formatted as `x, y`; color values are formatted as `r, g, b`. Separate component variables such as `global_xy_1_x` and `global_color_1_r` are also available.

## Actions and feedbacks

Typed actions cover playlists, Favs, scenes, presets, media, scene and meta controls, global controls, control operations, scene and meta banks, and control groups. String and numeric text fields accept Companion variables.

Available state feedback includes:

- current scene equals a configured name
- a global toggle position is on or off
- a selected global control component passes a numeric comparison
- supported Synesthesia feedback was received recently
- the local UDP listener is ready

Scene launch output provides the current scene name. Catalog discovery for every installed scene, preset, Fav name, or media source is not currently part of the documented OSC routes. Presets created through Companion are learned and persisted per scene; existing Synesthesia presets remain reachable by name or Fav position.

## Presets

The preset catalog includes playlist transport, positions 1 through 16, Favs 1 through 10, rendering on and off, scene and preset launch templates, media selection, scene and meta bank operations, brightness levels, and OSC state indicators. Creating a preset changes the current Synesthesia project, so its supplied button requires a one-second hold.

Global slider and knob rotary templates cover positions 1 through 16. Global toggle templates invert fresh normalized feedback and show the received on state. Global bang templates provide one trigger for each position. The richer Global Slider 1 preset retains the dynamic name and value LCD example described above.

## Dynamic performance surface

Dynamic surface actions compact active controls received through Synesthesia's **Global Addresses** output. Scene mode centers named toggles and bangs on the bottom button row and fills rotaries with sliders, knobs, dropdowns, XY controls, and colors. Meta mode centers its toggles and bangs on the bottom row; mirrors and Limit Colors are buttons while Low Color and High Color are RGB rotaries. Media mode contains media color, transform, playback, and overlay controls. Press Media a second time to show the configured exact-name source list; press it again to return to Media controls. Source Previous and Next remain available in both Media views. Unknown future Meta controls still use dimensional fallback discovery. Favs mode shows Fav 1 through 9 on its first page and Fav 2 through 10 on its second page.

The dynamic slots are logical controls, not a physical-device requirement. Map them onto any Companion-supported layout, spread them across multiple surfaces, or use only the controls that matter to a particular workflow. Controls Previous/Next makes smaller mappings practical. The full example maps 16 logical buttons and six logical rotaries; the compact example maps a smaller subset. These are example arrangements, not a compatibility list.

Controls Previous/Next advances the shared surface page. Each control area changes only when that area has additional content: if one page can hold all toggles and bangs, they remain visible while the same navigation pages through additional rotaries. Random All stays at the start of the Scene and Meta context row and randomizes both banks. Random Selected affects only the active Scene or Meta bank. The supplied Stream Deck + XL page also keeps Global Default and Global Undo in fixed positions. Global Undo combines the available Scene undo and Meta undo operations in sequence.

- Rotate to adjust the assigned normalized value.
- Press a dial to restore that control's default.
- Touch its LCD to toggle scalar lock state. For XY and color controls, touch cycles X/Y or R/G/B instead.
- Empty dynamic slots stay blank and do nothing.
- Generated preset names use `YY-MM-DD HH:MM:SS - Companion`.

## Example pages

The module includes plain, uncompressed page exports that can be reviewed before import:

- [Stream Deck + XL dynamic surface](assets/streamdeck-plus-xl-synesthesia-surface.companionconfig) demonstrates the complete 16-button and six-rotary logical surface.
- [Stream Deck + rotary surface](assets/streamdeck-plus-synesthesia-surface.companionconfig) is a compact starter page with the four modes, control paging, Global Default and Undo, and four dynamic rotaries.

Import an example from Companion's Buttons page, then map its placeholder **Synesthesia** connection to your connection. Adapt, rearrange, or split the example to suit the surfaces and controls in your workflow.

## Troubleshooting

- Turn on **Log OSC** in Synesthesia's console and trigger a Companion action. Confirm the expected path and argument arrive.
- Confirm Companion's target port equals Synesthesia's Input Port.
- Confirm Synesthesia's Output Port equals Companion's feedback listen port.
- Confirm Synesthesia and Companion both use normalized output expectations, or both use raw expectations.
- Use Global Addresses in Synesthesia if global name and value variables should follow scene changes.
- If **Listener Ready** is false, another process may own the port or the listen address may not exist on the Companion computer.
- Set **Control Address Format** to **Global Addresses**. Dynamic scene-control names and values use `/controls/global/{type}/{position}` routes; scene-specific output cannot populate those controls.
- **Feedback Recently Received** is a traffic indicator, not a connection state. Synesthesia output is event-driven, so it can become stale while the last received control values remain valid.
- If **Listener Ready** is true but no feedback ever becomes recent, check Synesthesia OSC Output, its destination address, firewall rules, and whether supported scene or global-control output is enabled.
- Native media Previous/Next follows Synesthesia's loaded order. Configured media/live-source buttons use only the exact allowlist in the connection settings, which provides a practical way to omit unwanted devices. Automatic checklist population can be added if media-source discovery becomes available through the OSC interface.
- Preset Previous/Next cycles `default`, legacy configured names, and presets created through Companion, persisted separately for each scene. Synesthesia's existing per-scene preset catalog and native preset-step operations are not exposed over OSC; Fav 1 through 10 remain the reliable quick access path for existing presets.
- For two computers, do not use `127.0.0.1` as the destination. It always refers to the sender's own computer.
