# @connected-repo/email

React Email templates for transactional emails using Resend.

## Usage

```typescript
import { render } from '@react-email/components';
import { MyTemplate } from '@connected-repo/email/templates/MyTemplate';

// Render email template
const html = await render(<MyTemplate name="John" />);
```

## Templates

Add React Email templates in `src/templates/`.
