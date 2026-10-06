import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Redirect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowUpRight, Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { useSession } from "../lib/session";
import { API_URL } from "../lib/api";
import { useTheme } from "../ui/theme";
import {
  Button,
  Card,
  Input,
  Loading,
  Logo,
  Notice,
  Screen,
  Txt,
} from "../ui/components";
export default function Login() {
  const {
      context,
      workspaces,
      loading,
      error: sessionError,
      login,
      restore,
      selectWorkspace,
      logout,
    } = useSession(),
    { colors } = useTheme();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (context) return <Redirect href="/(tabs)" />;
  if (loading)
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <Screen>
        <View style={{ paddingTop: 12, gap: 28 }}>
          <Logo />
          <LinearGradient
            colors={["#192b79", "#0c153b"]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={{
              borderRadius: 28,
              padding: 24,
              gap: 18,
              overflow: "hidden",
              minHeight: 200,
            }}
          >
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Txt
                weight="bold"
                style={{ color: "#aabaff", fontSize: 10, letterSpacing: 2 }}
              >
                YOUR OUTREACH. WITH YOU.
              </Txt>
              <ArrowUpRight color="#f9af03" size={22} />
            </View>
            <Txt
              weight="extra"
              style={{ color: "#fff", fontSize: 30, lineHeight: 37 }}
            >
              Good conversations{"\n"}start here
              <Txt style={{ color: "#f9af03", fontSize: 30 }}>.</Txt>
            </Txt>
            <Txt style={{ color: "#bdc9ed", fontSize: 13 }}>
              A calmer inbox. A faster reply.{"\n"}Your next opportunity, within
              reach.
            </Txt>
          </LinearGradient>
        </View>
        <View style={{ gap: 10 }}>
          <Txt weight="extra" style={{ fontSize: 27, lineHeight: 36 }}>
            {workspaces ? "Your workspaces" : "Welcome back"}
          </Txt>
          <Txt style={{ color: colors.muted }}>
            {workspaces
              ? "Choose a workspace to continue."
              : "Sign in to your ReliantOutreach account."}
          </Txt>
        </View>
        <Notice
          message={error || sessionError}
          onRetry={sessionError ? () => void restore() : undefined}
        />
        {workspaces ? (
          <View style={{ gap: 12 }}>
            {workspaces.items.length ? (
              workspaces.items.map((item) => (
                <Button
                  key={item.client.id}
                  title={item.client.company}
                  busy={busy}
                  onPress={() =>
                    void run(() => selectWorkspace(item.client.id))
                  }
                />
              ))
            ) : (
              <Card>
                <Txt>
                  No active client workspace is assigned to this account. Ask
                  your administrator to add your client membership.
                </Txt>
              </Card>
            )}
            <Button
              title="Sign out"
              secondary
              busy={busy}
              onPress={() => void run(logout)}
            />
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            <View style={{ gap: 8 }}>
              <Txt weight="medium">Email address</Txt>
              <Input
                accessibilityLabel="Email address"
                placeholder="you@company.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Txt weight="medium">Password</Txt>
              <View>
                <Input
                  accessibilityLabel="Password"
                  placeholder="Enter your password"
                  secureTextEntry={!show}
                  textContentType="password"
                  autoComplete="current-password"
                  value={password}
                  onChangeText={setPassword}
                  style={{ paddingRight: 52 }}
                  onSubmitEditing={() => {
                    if (email && password && !busy)
                      void run(() => login(email, password));
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={show ? "Hide password" : "Show password"}
                  onPress={() => setShow(!show)}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: 4,
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {show ? (
                    <EyeOff size={18} color={colors.muted} />
                  ) : (
                    <Eye size={18} color={colors.muted} />
                  )}
                </Pressable>
              </View>
            </View>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(API_URL + "/forgot-password")}
              style={{
                minHeight: 44,
                justifyContent: "center",
                alignSelf: "flex-end",
              }}
            >
              <Txt style={{ color: colors.link }}>Forgot password?</Txt>
            </Pressable>
            <Button
              title="Sign in  →"
              busy={busy}
              disabled={!email.trim() || !password}
              onPress={() => void run(() => login(email, password))}
            />
            <Txt
              style={{ color: colors.muted, textAlign: "center", fontSize: 12 }}
            >
              New here? Ask your workspace administrator for an invitation.
            </Txt>
          </View>
        )}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 8,
          }}
        >
          <ShieldCheck size={15} color={colors.muted} />
          <Txt style={{ color: colors.muted, fontSize: 11 }}>
            Your workspace. Secure and private.
          </Txt>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
