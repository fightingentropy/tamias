import { track } from "@/lib/telemetry/client";
import { LogEvents } from "@/lib/telemetry/events";
import { getTellerApplicationId, getTellerEnvironment } from "@tamias/utils/envs";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { useConnectParams } from "@/hooks/use-connect-params";
import { BankConnectButton } from "./bank-connect-button";

type Props = {
  id: string;
  onSelect: (id: string) => void;
  connectRef?: React.MutableRefObject<(() => void) | null>;
};

export function TellerConnect({ id, onSelect, connectRef }: Props) {
  const [institution, setInstitution] = useState<string | undefined>();
  const { setParams } = useConnectParams();
  const { theme } = useTheme();
  const tellerApplicationId = getTellerApplicationId();
  const tellerEnvironment = getTellerEnvironment();

  useEffect(() => {
    if (institution) {
      // @ts-expect-error
      const teller = window.TellerConnect.setup({
        applicationId: tellerApplicationId,
        environment: tellerEnvironment,
        institution,
        appearance: theme,
        onSuccess: (authorization: { accessToken: string; enrollment: { id: string } }) => {
          setParams({
            step: "account",
            provider: "teller",
            token: authorization.accessToken,
            enrollment_id: authorization.enrollment.id,
          });

          track({
            event: LogEvents.ConnectBankAuthorized.name,
            channel: LogEvents.ConnectBankAuthorized.channel,
            provider: "teller",
          });
        },
        onExit: () => {
          setParams({ step: "connect" });
          track({
            event: LogEvents.ConnectBankCanceled.name,
            channel: LogEvents.ConnectBankCanceled.channel,
            provider: "teller",
          });

          setParams({ step: "connect" });
        },
        onFailure: () => {
          setParams({ step: "connect" });
        },
      });

      // NOTE: Because we are configure Teller with institution we need to
      // Regenerate the SDK, and that gives us a white background, let's wait until it's fully loaded
      setTimeout(() => {
        teller.open();
      }, 1000);
    }
  }, [institution, tellerApplicationId, tellerEnvironment, theme, setParams]);

  return (
    <BankConnectButton
      connectRef={connectRef}
      onClick={() => {
        onSelect(id);
        setInstitution(id);
      }}
    />
  );
}
