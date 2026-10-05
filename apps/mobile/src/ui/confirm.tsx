import { Modal, View } from "react-native";
import type { ReactNode } from "react";
import { Button, Card, Txt } from "./components";
export function Confirm({
  title,
  children,
  open,
  busy,
  onCancel,
  onConfirm,
  action = "Confirm",
}: {
  title: string;
  children: ReactNode;
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  action?: string;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onCancel();
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#0009",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card
          style={{ width: "100%", maxWidth: 460, alignSelf: "center", gap: 18 }}
        >
          <Txt weight="bold" style={{ fontSize: 20 }}>
            {title}
          </Txt>
          {children}
          <Button title={action} busy={busy} onPress={onConfirm} />
          <Button title="Cancel" secondary disabled={busy} onPress={onCancel} />
        </Card>
      </View>
    </Modal>
  );
}
