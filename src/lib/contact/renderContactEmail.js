import { render } from "@react-email/render";
import ContactFormEmail from "@/emails/ContactFormEmail";
import { formatDisplayDateTime } from "@/lib/formatDate";

/** @param {Parameters<typeof ContactFormEmail>[0]} props */
export async function renderContactFormEmail(props) {
  const receivedAt = formatDisplayDateTime(props.receivedAtMs);
  const { receivedAtMs: _receivedAtMs, ...rest } = props;
  return render(<ContactFormEmail {...rest} receivedAt={receivedAt} />);
}
