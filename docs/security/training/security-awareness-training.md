# Security Awareness Training

**Document Version:** 1.0
**Status:** Production-Ready
**Last Updated:** 2026-01-13
**Target Audience**: All Employees

---

## Course Overview

This security awareness training program is designed for all ClaudeFlare employees to understand their role in maintaining security and protecting company and customer data.

### Learning Objectives

By the end of this training, employees will be able to:

1. Recognize security threats and vulnerabilities
2. Follow security policies and procedures
3. Protect sensitive information
4. Respond appropriately to security incidents
5. Maintain security best practices in daily work

### Training Format

- **Duration**: 2 hours
- **Format**: Interactive modules with scenarios
- **Frequency**: Annually (with quarterly refreshers)
- **Assessment**: Quiz and acknowledgment

---

## Module 1: Security Fundamentals (20 minutes)

### Why Security Matters

#### The Human Factor

```
┌─────────────────────────────────────────────────────────────┐
│                  THE SECURITY CHAIN                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Technology  ───┐                                           │
│                │                                           │
│  Process     ──┼──┐                                        │
│                │  │                                        │
│  People      ──┴──┴──▶ WEAKEST LINK                        │
│                                                              │
│  "Security is everyone's responsibility"                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Statistics**:
- 95% of security breaches involve human error
- 60% of small businesses close within 6 months of a cyber attack
- Average cost of a data breach: $4.45 million
- Average time to identify a breach: 287 days

### The CIA Triad

#### Confidentiality, Integrity, Availability

1. **Confidentiality**: Protecting sensitive information from unauthorized access
   - Examples: Customer data, proprietary code, financial information
   - Your role: Use strong passwords, don't share sensitive data

2. **Integrity**: Ensuring data accuracy and completeness
   - Examples: Code repositories, database records, financial transactions
   - Your role: Verify data accuracy, report discrepancies

3. **Availability**: Ensuring systems are accessible when needed
   - Examples: Web services, development tools, communication systems
   - Your role: Don't abuse resources, report outages

### Scenario 1: The Suspicious Email

**Situation**: You receive an email from "IT Support" asking you to click a link to verify your password.

**Questions**:
1. What should you do?
2. What are the red flags?

**Answers**:
1. **Do not click the link**. Report the email to security@claudeflare.com
2. **Red flags**:
   - Unsolicited request for sensitive information
   - Urgent language ("verify immediately")
   - Generic greeting ("Dear User")
   - Slight misspellings or domain variations

---

## Module 2: Common Threats (30 minutes)

### Phishing

#### What is Phishing?

Phishing is a type of social engineering attack where attackers deceive victims into revealing sensitive information or performing actions.

#### Types of Phishing

| Type | Description | Example |
|------|-------------|---------|
| **Email Phishing** | Fraudulent emails sent to many targets | Fake password reset |
| **Spear Phishing** | Targeted attacks on specific individuals | Executive impersonation |
| **Whaling** | Targeting senior executives | Fake wire transfer request |
| **Smishing** | SMS/text message phishing | Fake delivery notification |
| **Vishing** | Voice phishing | Fake tech support call |

#### Phishing Indicators

**Red Flags**:
- Urgent or threatening language
- Request for sensitive information
- Generic greetings
- Misspellings and poor grammar
- Suspicious URLs (hover to check)
- Unexpected attachments
- Too good to be true offers

**Best Practices**:
- Always verify the sender
- Don't click suspicious links
- Don't open unexpected attachments
- Verify requests through another channel
- Report suspicious emails

### Social Engineering

#### What is Social Engineering?

Social engineering manipulates people into divulging confidential information or performing actions.

#### Common Tactics

1. **Pretexting**: Creating a fabricated scenario to obtain information
   - Example: "I'm from IT and need your password to fix your account"

2. **Baiting**: Offering something enticing to trick victims
   - Example: USB drive labeled "Employee Salaries" left in parking lot

3. **Tailgating**: Following someone through a secure door
   - Example: "Hold the door, I forgot my badge"

4. **Quid Pro Quo**: Offering a benefit in exchange for information
   - Example: "I'll help you with your ticket if you give me your password"

### Malware

#### Common Malware Types

| Type | Description | Protection |
|------|-------------|------------|
| **Ransomware** | Encrypts data and demands payment | Backups, endpoint protection |
| **Spyware** | Collects user activity | Antivirus, browser protection |
| **Trojan** | Disguises as legitimate software | Only download from trusted sources |
| **Worm** | Spreads across networks | Keep systems updated |
| **Keylogger** | Records keystrokes | Secure input methods, MFA |

### Password Attacks

#### Attack Methods

1. **Brute Force**: Trying all possible combinations
   - Protection: Account lockout after failed attempts

2. **Dictionary Attack**: Trying common passwords
   - Protection: Password complexity requirements

3. **Credential Stuffing**: Using leaked credentials from other sites
   - Protection: Unique passwords, MFA

4. **Shoulder Surfing**: Watching someone type their password
   - Protection: Be aware of surroundings, use password managers

### Scenario 2: The Urgent Request

**Situation**: You receive a Slack message from the CEO (appears to be from their account) asking you to urgently wire transfer $50,000 to a vendor.

**Questions**:
1. What should you do?
2. What are the red flags?

**Answers**:
1. **Do not transfer**. Verify through another channel (phone call, in-person)
2. **Red flags**:
   - Unusual request via chat/IM
   - Urgent timeline
   - Large amount
   - Bypasses normal procedures
   - Even if it appears to be from a trusted source

---

## Module 3: Data Protection (25 minutes)

### Data Classification

#### Classification Levels

| Level | Definition | Example | Handling |
|-------|------------|---------|----------|
| **Public** | Can be shared freely | Marketing materials | No restrictions |
| **Internal** | For internal use only | Internal documentation | Company only |
| **Confidential** | Sensitive business information | Customer data | Restricted access |
| **Restricted** | Highly sensitive | Credentials, keys | Need-to-know basis |

### Handling Sensitive Data

#### Best Practices

**DO**:
- Encrypt sensitive data
- Use secure transmission methods
- Follow data retention policies
- Report data spills immediately
- Use company-approved tools

**DON'T**:
- Share credentials
- Store data on personal devices
- Email unencrypted sensitive data
- Leave sensitive information visible
- Copy data to unauthorized locations

### Data Spill Response

#### What is a Data Spill?

A data spill is the unauthorized disclosure of sensitive information.

#### Response Steps

1. **Stop the spill**: Prevent further disclosure
2. **Secure the data**: Protect exposed information
3. **Report immediately**: Notify security@claudeflare.com
4. **Document**: Record what happened
5. **Cooperate**: Assist with investigation

**Example**: You accidentally email a customer list to your personal email address.

**Response**:
1. Stop sending the email (if possible)
2. Contact IT to recall the message
3. Report to security@claudeflare.com
4. Document the incident
5. Follow up on remediation steps

### Scenario 3: The Lost Device

**Situation**: You leave your company laptop at a coffee shop.

**Questions**:
1. What should you do immediately?
2. What information do you need to provide?

**Answers**:
1. **Report immediately** to security@claudeflare.com
2. **Provide**:
   - Device serial number
   - Last known location
   - Time of loss
   - Whether device was password protected
   - What sensitive data might be on the device

---

## Module 4: Security Policies (20 minutes)

### Acceptable Use Policy

#### Permitted Activities

- Using company resources for business purposes
- Following security best practices
- Reporting security concerns
- Maintaining data confidentiality

#### Prohibited Activities

- Sharing passwords or credentials
- Installing unauthorized software
- Circumventing security controls
- Misusing company resources
- Accessing data without authorization

### Bring Your Own Device (BYOD)

#### Requirements

- Device must be password protected
- Device must have current OS updates
- Device must have company-approved security software
- Lost/stolen devices must be reported immediately
- Company data must be removed when employment ends

### Remote Work Security

#### Best Practices

**Physical Security**:
- Lock your computer when not in use
- Don't leave devices in cars
- Use privacy screens in public places
- Be aware of your surroundings

**Network Security**:
- Use company VPN for all work
- Don't use public Wi-Fi for work
- Verify network names (attackers use similar names)
- Use company-approved collaboration tools

**Device Security**:
- Keep software updated
- Use strong passwords/biometrics
- Encrypt sensitive data
- Report suspicious activity

### Social Media Safety

#### Risks

- Information disclosure
- Social engineering
- Reputation damage
- Account compromise

#### Best Practices

- Don't share work information
- Review privacy settings regularly
- Be cautious of connection requests
- Think before you post
- Report suspicious accounts

### Scenario 4: The Social Media Post

**Situation**: You're excited about a new project and want to share details on LinkedIn.

**Questions**:
1. What should you consider before posting?
2. What information should you avoid sharing?

**Answers**:
1. **Consider**:
   - Company social media policy
   - Whether the information is public or confidential
   - Potential impact if competitors see the post
   - Whether you're authorized to share

2. **Avoid sharing**:
   - Unannounced products/features
   - Technical details or architecture
   - Customer information
   - Internal processes
   - Security vulnerabilities or incidents

---

## Module 5: Incident Response (15 minutes)

### Recognizing Security Incidents

#### Signs of an Incident

**Unusual System Behavior**:
- Slow performance
- Unexpected pop-ups
- Programs opening/closing on their own
- Files appearing/disappearing
- Unusual error messages

**Account Issues**:
- Unable to log in
- Password suddenly stops working
- Unusual login locations
- Unexpected password reset emails
- Messages you didn't send

**Data Issues**:
- Files encrypted/unable to open
- Missing or modified files
- Unusual access patterns
- Data in unexpected places

### Reporting Security Incidents

#### How to Report

**Email**: security@claudeflare.com
**Slack**: #security-incidents
**Phone**: [Security Team Hotline]
**Urgent**: Contact Security Team directly

#### What to Include

- Your name and contact information
- What happened (description)
- When it happened
- What systems/data are affected
- What actions you've taken

### Incident Response Process

```
┌─────────────────────────────────────────────────────────────┐
│              INCIDENT RESPONSE PROCESS                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. REPORT                                                  │
│     └── Notify security team immediately                   │
│                                                              │
│  2. CONTAIN                                                 │
│     └── Limit damage (disconnect from network)             │
│                                                              │
│  3. PRESERVE                                                │
│     └── Don't modify/delete anything                        │
│                                                              │
│  4. COOPERATE                                               │
│     └── Work with security team                            │
│                                                              │
│  5. LEARN                                                   │
│     └── Participate in post-incident review                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Scenario 5: The Ransomware Attack

**Situation**: You open a file and suddenly all your files are renamed with a strange extension and you see a message demanding payment.

**Questions**:
1. What should you do immediately?
2. What should you NOT do?

**Answers**:
1. **DO**:
   - Disconnect from the network (unplug ethernet, turn off Wi-Fi)
   - Leave the computer on (don't shut down)
   - Report immediately to security@claudeflare.com
   - Document what you were doing when it happened

2. **DON'T**:
   - Pay the ransom
   - Try to remove the malware yourself
   - Shut down the computer
   - Hide the incident
   - Tell colleagues (except security team)

---

## Module 6: Physical Security (10 minutes)

### Badge Access

#### Best Practices

- Wear your badge visibly at all times
- Don't share your badge with others
- Report lost/stolen badges immediately
- Don't tailgate through secure doors
- Challenge unknown individuals without badges
- Use the "turnstile rule": one person, one swipe

### Clean Desk Policy

#### Requirements

- Lock your computer when away from desk
- Secure sensitive documents
- Don't leave passwords on sticky notes
- Clear desk of sensitive materials when leaving
- Lock filing cabinets

### Visitor Management

#### Procedures

- All visitors must be escorted
- Visitors must wear visitor badges
- Don't share sensitive information in front of visitors
- Report unescorted visitors
- Verify visitor identity before granting access

---

## Assessment

### Quiz (15 questions)

1. **What is the primary cause of most security breaches?**
   - a) Sophisticated hackers
   - b) Human error
   - c) Outdated software

2. **What should you do if you receive a suspicious email?**
   - a) Click the link to check
   - b) Reply asking if it's legitimate
   - c) Report to security@claudeflare.com

3. **What is phishing?**
   - a) A type of fishing
   - b) Social engineering attack
   - c) Network scanning

4. **What is the best way to handle passwords?**
   - a) Use the same password everywhere
   - b) Share with trusted colleagues
   - c) Use unique, strong passwords and a password manager

5. **What should you do if you lose your company laptop?**
   - a) Hope it turns up
   - b) Report immediately
   - c) Buy a replacement

6. **What is a data spill?**
   - a) Accidentally deleting data
   - b) Unauthorized disclosure of sensitive information
   - c) Running out of storage

7. **What is the first step in responding to a security incident?**
   - a) Fix the problem yourself
   - b) Report to security team
   - c) Tell your colleagues

8. **What should you do if someone tails you through a secure door?**
   - a) Let them through to be polite
   - b) Ask to see their badge
   - c) Ignore them

9. **What is the clean desk policy?**
   - a) Clean your desk daily
   - b) Secure sensitive materials when away
   - c) Don't have personal items

10. **What is social engineering?**
    - a) Engineering social media
    - b) Manipulating people to divulge information
    - c) Building social networks

11. **What should you do if you suspect a security incident?**
    - a) Wait and see if it gets worse
    - b) Report immediately
    - c) Try to fix it yourself

12. **What is the best way to verify a suspicious request?**
    - a) Reply to the email
    - b) Use another communication channel
    - c) Ask a colleague

13. **What is the purpose of multi-factor authentication?**
    - a) To annoy users
    - b) To add an extra layer of security
    - c) To replace passwords

14. **What should you do if you receive a USB drive in the mail?**
    - a) Plug it in to see what's on it
    - b) Give it to IT
    - c) Throw it away

15. **What is the most important security principle?**
    - a) Security is IT's job
    - b) Security is everyone's responsibility
    - c) Security is too complicated

### Answers

1. b) Human error
2. c) Report to security@claudeflare.com
3. b) Social engineering attack
4. c) Use unique, strong passwords and a password manager
5. b) Report immediately
6. b) Unauthorized disclosure of sensitive information
7. b) Report to security team
8. b) Ask to see their badge
9. b) Secure sensitive materials when away
10. b) Manipulating people to divulge information
11. b) Report immediately
12. b) Use another communication channel
13. b) To add an extra layer of security
14. b) Give it to IT
15. b) Security is everyone's responsibility

---

## Resources

### Security Contacts

**Security Team**: security@claudeflare.com
**Incident Reporting**: security@claudeflare.com
**General Questions**: security@claudeflare.com

### Internal Resources

- Security Policies: Company intranet
- Incident Reporting: #security-incidents Slack channel
- Security Awareness: Monthly newsletter

### External Resources

- Phishing Quiz: https://phishingquiz.withgoogle.com/
- Password Strength Test: https://passwords.google.com/
- Security Training: https://www.cisa.gov/cybersecurity-awareness

---

## Completion Checklist

- [ ] Complete all 6 modules
- [ ] Pass quiz (80% minimum)
- [ ] Sign security policy acknowledgment
- [ ] Complete quarterly security refreshers
- [ ] Report any security concerns

---

## Security Pledge

"As a member of the ClaudeFlare team, I pledge to:

- Protect company and customer information
- Follow security policies and procedures
- Report security concerns promptly
- Maintain vigilance against threats
- Continuously improve my security awareness

I understand that security is everyone's responsibility and I commit to doing my part."

**Signature**: __________________________
**Date**: __________________________

---

## Contact

**Security Team**: security@claudeflare.com
**Training Questions**: training@claudeflare.com

---

**Document Owner**: Security Team
**Review Cycle**: Annually
**Next Review**: 2027-01-13
