/*
 * Tiling Controls: a small panel for the "Alternating Master Stack" KWin
 * script (alternating tiling with smart sizing). Every button triggers one of the script's shortcuts through
 * KGlobalAccel, exactly as if you had pressed the key. Actions apply to the
 * tiled window you were last using (the script remembers it, so clicking
 * here doesn't change the target).
 */
import QtQuick
import QtQuick.Layouts
import QtQuick.Controls as QQC2
import org.kde.plasma.plasmoid
import org.kde.plasma.plasma5support as P5Support
import org.kde.kirigami as Kirigami

PlasmoidItem {
    id: root

    property int counter: 0
    property int sharePct: 50

    Plasmoid.icon: "view-grid"
    toolTipMainText: "Tiling controls"
    toolTipSubText: "Window sizes and order"

    P5Support.DataSource {
        id: runner
        engine: "executable"
        connectedSources: []
        onNewData: function (source, data) {
            disconnectSource(source)
        }
    }

    // Runs the script shortcut called "Alternating Tile: <name>".
    function trigger(name) {
        counter += 1
        runner.connectSource("dbus-send --session --type=method_call"
            + " --dest=org.kde.kglobalaccel /component/kwin"
            + " org.kde.kglobalaccel.Component.invokeShortcut"
            + " string:'Alternating Tile: " + name + "' # " + counter)
    }

    component Heading: QQC2.Label {
        font.bold: true
        Layout.topMargin: Kirigami.Units.smallSpacing
    }

    component Action: QQC2.Button {
        Layout.fillWidth: true
    }

    fullRepresentation: ColumnLayout {
        id: panel
        spacing: Kirigami.Units.smallSpacing
        Layout.minimumWidth: Kirigami.Units.gridUnit * 21
        Layout.preferredWidth: Kirigami.Units.gridUnit * 21

        Heading { text: "Sizing" }
        RowLayout {
            Layout.fillWidth: true
            Action { text: "Smart sizing on/off"; onClicked: root.trigger("Toggle Smart Sizing") }
            Action { text: "Reset all sizes"; onClicked: { root.sharePct = 50; root.trigger("Reset Ratios") } }
        }

        Heading { text: "Size of the focused window" }
        RowLayout {
            Layout.fillWidth: true
            QQC2.Slider {
                id: shareSlider
                Layout.fillWidth: true
                from: 30
                to: 80
                stepSize: 5
                snapMode: QQC2.Slider.SnapAlways
                value: root.sharePct
                onPressedChanged: {
                    if (!pressed) {
                        root.sharePct = Math.round(value)
                        root.trigger("Share " + Math.round(value))
                    }
                }
            }
            QQC2.Label {
                text: Math.round(shareSlider.value) + "%"
                font.bold: true
                Layout.minimumWidth: Kirigami.Units.gridUnit * 2
                horizontalAlignment: Text.AlignRight
            }
        }
        RowLayout {
            Layout.fillWidth: true
            Action { text: "40%"; onClicked: { root.sharePct = 40; root.trigger("Share 40") } }
            Action { text: "50%"; onClicked: { root.sharePct = 50; root.trigger("Share 50") } }
            Action { text: "60%"; onClicked: { root.sharePct = 60; root.trigger("Share 60") } }
            Action { text: "70%"; onClicked: { root.sharePct = 70; root.trigger("Share 70") } }
        }
        RowLayout {
            Layout.fillWidth: true
            Action { text: "Narrower"; onClicked: root.trigger("Ratio Narrower") }
            Action { text: "Wider"; onClicked: root.trigger("Ratio Wider") }
            Action { text: "Shorter"; onClicked: root.trigger("Ratio Shorter") }
            Action { text: "Taller"; onClicked: root.trigger("Ratio Taller") }
        }
        Heading { text: "Order and spacing" }
        RowLayout {
            Layout.fillWidth: true
            Action { text: "Rotate back"; onClicked: root.trigger("Rotate Windows Backward") }
            Action { text: "Rotate forward"; onClicked: root.trigger("Rotate Windows Forward") }
            Action { text: "Mirror"; onClicked: root.trigger("Mirror Layout") }
            Action { text: "Gaps on/off"; onClicked: root.trigger("Toggle Gaps") }
        }

        Heading { text: "Window" }
        RowLayout {
            Layout.fillWidth: true
            Action { text: "Float / tile"; onClicked: root.trigger("Toggle Floating") }
            Action { text: "Make master"; onClicked: root.trigger("Promote to Master") }
        }
        Action {
            text: "Always float / tile this app"
            onClicked: root.trigger("Toggle Float for This App")
        }
        RowLayout {
            Layout.fillWidth: true
            Action { text: "Previous window"; onClicked: root.trigger("Focus Previous Window") }
            Action { text: "Next window"; onClicked: root.trigger("Focus Next Window") }
        }

        QQC2.Label {
            Layout.fillWidth: true
            wrapMode: Text.WordWrap
            opacity: 0.7
            font.italic: true
            text: "Acts on the window you were last using. Keyboard shortcuts keep working; "
                + "the slider shows what you last chose here, not the current size."
        }
    }
}
