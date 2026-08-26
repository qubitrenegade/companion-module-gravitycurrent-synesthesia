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

OSC is UDP. A local send does not prove that Synesthesia received or applied an action. The **Listener Ready** feedback means only that Companion opened its local UDP socket. The **Feedback Recently Received** feedback means Synesthesia sent at least one supported scene or global-control message within the configured freshness timeout.

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

Relative rotary actions need inbound normalized values. If feedback is disabled, stale, configured as raw, or Synesthesia is not outputting global normalized controls, use **Global Control: Set Value** for absolute control instead.

XY values are formatted as `x, y`; color values are formatted as `r, g, b`. Separate component variables such as `global_xy_1_x` and `global_color_1_r` are also available.

## Actions and feedbacks

Typed actions cover playlists, favslots, scenes, presets, media, scene and meta controls, global controls, control operations, scene and meta banks, and control groups. String and numeric text fields accept Companion variables.

Available state feedback includes:

- current scene equals a configured name
- a global toggle position is on or off
- a selected global control component passes a numeric comparison
- supported Synesthesia feedback was received recently
- the local UDP listener is ready

Scene launch output provides the current scene name. The documented API does not provide a list of every installed scene or preset, so the module does not promise enumeration.

## Troubleshooting

- Turn on **Log OSC** in Synesthesia's console and trigger a Companion action. Confirm the expected path and argument arrive.
- Confirm Companion's target port equals Synesthesia's Input Port.
- Confirm Synesthesia's Output Port equals Companion's feedback listen port.
- Confirm Synesthesia and Companion both use normalized output expectations, or both use raw expectations.
- Use Global Addresses in Synesthesia if global name and value variables should follow scene changes.
- If **Listener Ready** is false, another process may own the port or the listen address may not exist on the Companion computer.
- If **Listener Ready** is true but **Feedback Recently Received** is false, check Synesthesia OSC Output, its destination address, firewall rules, and whether supported scene or global-control output is enabled.
- For two computers, do not use `127.0.0.1` as the destination. It always refers to the sender's own computer.
