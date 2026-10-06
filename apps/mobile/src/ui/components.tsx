import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextProps,
  type TextInputProps,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, UserRound } from "lucide-react-native";
import { useTheme } from "./theme";
export function Txt({
  style,
  weight = "regular",
  ...props
}: TextProps & { weight?: "regular" | "medium" | "bold" | "extra" }) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: colors.text,
          fontFamily: {
            regular: "Jakarta",
            medium: "JakartaMedium",
            bold: "JakartaBold",
            extra: "JakartaExtra",
          }[weight],
          fontSize: 14,
          lineHeight: 22,
        },
        style,
      ]}
    />
  );
}
export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: 22,
            paddingBottom: 36,
            gap: 22,
            width: "100%",
            maxWidth: 680,
            alignSelf: "center",
          }}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          padding: 20,
          borderRadius: 22,
          backgroundColor: colors.panel,
          borderWidth: 1,
          borderColor: colors.line,
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  title,
  onPress,
  busy,
  disabled,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: 15,
        paddingVertical: 13,
        paddingHorizontal: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: secondary ? colors.inset : colors.brand,
        opacity: disabled || busy ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.text : "#fff"} />
      ) : (
        <Txt weight="bold" style={{ color: secondary ? colors.text : "#fff" }}>
          {title}
        </Txt>
      )}
    </Pressable>
  );
}
export function Input(props: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={colors.muted}
      selectionColor={colors.link}
      style={[
        {
          minHeight: 52,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 14,
          backgroundColor: colors.inset,
          borderWidth: 1,
          borderColor: colors.line,
          color: colors.text,
          fontFamily: "Jakarta",
          fontSize: 15,
        },
        props.style,
      ]}
    />
  );
}
export function Header({
  title,
  subtitle,
  back = false,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      {back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
          style={{
            minHeight: 44,
            minWidth: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 14,
            backgroundColor: colors.panel,
          }}
        >
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        <Txt
          weight="extra"
          numberOfLines={compact ? 1 : undefined}
          style={{ fontSize: compact ? 20 : 28, lineHeight: compact ? 28 : 36 }}
        >
          {title}
        </Txt>
        {subtitle && (
          <Txt
            numberOfLines={compact ? 1 : undefined}
            style={{ color: colors.muted, fontSize: 12 }}
          >
            {subtitle}
          </Txt>
        )}
      </View>
      {!back && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Account and settings"
          onPress={() => router.push("/account")}
          style={{
            height: 46,
            width: 46,
            borderRadius: 16,
            backgroundColor: colors.panel,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <UserRound size={20} color={colors.secondary} />
        </Pressable>
      )}
    </View>
  );
}
export function Notice({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <Card>
      <Txt style={{ color: colors.secondary }}>{message}</Txt>
      {onRetry && <Button title="Try again" secondary onPress={onRetry} />}
    </Card>
  );
}
export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ padding: 40, alignItems: "center" }}>
      <ActivityIndicator size="large" color={colors.brand} />
      <Txt style={{ color: colors.muted, marginTop: 14 }}>
        Connecting your workspace…
      </Txt>
    </View>
  );
}
export function Logo() {
  const { mode } = useTheme();
  return (
    <Image
      accessibilityLabel="ReliantOutreach"
      source={
        mode === "dark"
          ? require("../../assets/logo-white.png")
          : require("../../assets/logo-black.png")
      }
      style={{ width: 180, height: 28 }}
      resizeMode="contain"
    />
  );
}
