import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FAQ_ITEMS = [
  {
    question: "Who is eligible to apply?",
    answer:
      "Any current undergraduate or graduate student (18+) from any school worldwide is eligible to apply. You do not need to be a computer science student.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Hack 4 Social Good is completely free to attend! We provide meals, snacks, swag, and a great experience at no cost to you.",
  },
  {
    question: "Do I need a team?",
    answer:
      "No! You can apply as an individual and form a team at the event. Teams can have up to 4 members.",
  },
  {
    question: "What if my school isn't listed?",
    answer:
      "You can type in your school name in the school field. If you're having trouble, reach out to us at operations@t4sg.dev.",
  },
  {
    question: "Can I attend virtually?",
    answer:
      "Hack 4 Social Good is an in-person event only. You must be able to attend in person for all 3 days.",
  },
  {
    question: "When will I hear back about my application?",
    answer:
      "Decisions will be released in batches after the application deadline. Check your dashboard for updates.",
  },
  {
    question: "I found a bug or have an issue. Who do I contact?",
    answer:
      "Please email us at operations@t4sg.dev with a description of the issue and we'll help you out.",
  },
];

export default function FaqPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Frequently Asked Questions
        </h1>
        <p className="text-gray-500 mt-1">
          Common questions about Hack 4 Social Good 2027
        </p>
      </div>

      <div className="space-y-4">
        {FAQ_ITEMS.map((item, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-base">{item.question}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{item.answer}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
