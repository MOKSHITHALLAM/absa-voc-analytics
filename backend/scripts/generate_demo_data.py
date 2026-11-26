"""Generate a SMALL SYNTHETIC sample in the same shape as HRAST.

It exists only so the project runs end-to-end before the real HRAST file is
downloaded. The sentences are produced from templates, so every metric
computed on it is NOT a research result. The file name, the results page and
the API all flag it as synthetic.

Usage:  python scripts/generate_demo_data.py
"""
from __future__ import annotations

import csv
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.config import DEFAULT_ASPECTS, DEMO_FILE  # noqa: E402

SEED = 2026
N = 4000

BANK = {
    "Room": (["the room was spacious and modern", "our room was lovely", "the room was bright and tastefully decorated", "we got a very nice room upgrade", "the room had everything we needed"],
             ["the room was tiny and dated", "our room smelled musty", "the room was much smaller than the photos", "the room felt old and tired", "the room was dark and cramped"],
             ["the room was on the third floor", "we had a double room facing the courtyard", "the room had a desk and a wardrobe"]),
    "Location": (["the location is perfect for sightseeing", "great location close to the metro", "the hotel is in an ideal spot near the old town", "walking distance to everything", "fantastic location by the river"],
                 ["the location is far from the centre", "the area around the hotel felt unsafe at night", "the location was inconvenient without a car", "the neighbourhood was quite dodgy", "it is a long walk to any attraction"],
                 ["the hotel is about twenty minutes from the station", "the hotel is located in the business district", "the hotel is on a side street"]),
    "Staff": (["the staff were friendly and helpful", "reception staff went out of their way for us", "the team was welcoming and professional", "the concierge gave us excellent tips", "staff were polite and attentive"],
              ["the staff were rude and unhelpful", "reception was dismissive when we complained", "the staff seemed disinterested", "nobody at the desk spoke to us kindly", "staff ignored our requests"],
              ["the staff spoke english and german", "there was one person at the reception", "staff change shifts at midnight"]),
    "Cleanliness": (["everything was spotless", "the room was very clean", "housekeeping kept the room immaculate", "the hotel was clean and tidy", "cleaning was excellent every day"],
                    ["the room was dirty", "there was dust everywhere", "we found hair on the sheets", "the carpet was stained and filthy", "housekeeping never cleaned properly"],
                    ["the room was cleaned every second day", "housekeeping comes in the morning", "cleaning is done on request"]),
    "Facilities/Amenities": (["the spa and gym were excellent", "great facilities including a pool", "the amenities were top notch", "the rooftop terrace was a highlight", "plenty of facilities for families"],
                             ["the pool was closed for our whole stay", "the gym equipment was broken", "facilities were very limited", "the sauna was out of order", "no amenities worth mentioning"],
                             ["the hotel has a small gym", "there is a pool on the roof", "the spa opens at nine"]),
    "Comfort": (["it was very comfortable", "a cosy and comfortable stay", "we felt comfortable and relaxed", "the room was comfortable and quiet", "really comfortable atmosphere"],
                ["it was not comfortable at all", "the room felt uncomfortable", "we were uncomfortable the whole night", "the chairs were uncomfortable", "not a comfortable place to relax"],
                ["comfort levels were as expected for the price", "the room had standard furniture"]),
    "Bed": (["the bed was super comfy", "the mattress was excellent", "the bed was large and soft", "best bed I have slept in", "the pillows and bed were great"],
            ["the bed was hard and lumpy", "the mattress was worn out", "the bed was too small for two", "the bed creaked all night", "the pillows were flat and the bed sagged"],
            ["there were two single beds", "the bed was a queen size", "an extra bed was added"]),
    "Bathroom/Shower": (["the bathroom was modern and clean", "great rain shower", "the shower had excellent pressure", "lovely bathroom with a big tub", "the bathroom was newly renovated"],
                        ["the shower was cold", "the bathroom was mouldy", "the shower drain was blocked", "the toilet kept running", "water pressure in the shower was terrible"],
                        ["the bathroom had a shower but no bathtub", "the toilet is separate from the shower", "towels were in the bathroom"]),
    "Noise": (["the room was very quiet", "we slept peacefully with no noise", "surprisingly quiet for a city hotel", "good soundproofing", "a calm and silent night"],
              ["it was very noisy", "we could hear traffic all night", "the walls are paper thin and noisy", "construction noise woke us early", "loud music from the bar kept us awake"],
              ["the room faced the street", "the hotel is near a tram line"]),
    "Wi-Fi": (["the wifi was fast and free", "excellent wifi throughout", "internet worked perfectly", "strong wifi signal in the room", "free wifi that actually works"],
              ["the wifi kept dropping", "internet was painfully slow", "wifi did not work in our room", "the wifi was unusable", "we had to pay for weak wifi"],
              ["wifi password is given at check in", "the hotel offers wifi"]),
    "Lift": (["the lift was quick", "a modern elevator made it easy", "the lift was convenient with luggage", "the elevator was spacious", "glad there was a fast lift"],
             ["the lift was broken", "the elevator was out of service", "we waited ages for the lift", "the lift was tiny and slow", "no working elevator with heavy bags"],
             ["the lift goes to the fifth floor", "there is one elevator"]),
    "Breakfast/Food": (["breakfast was delicious", "a great breakfast buffet", "the food in the restaurant was excellent", "fresh pastries and good coffee at breakfast", "dinner was tasty"],
                       ["breakfast was poor", "the food was cold and bland", "breakfast choice was very limited", "the coffee was awful", "the restaurant food was overpriced and bad"],
                       ["breakfast is served from seven", "breakfast was included in the rate", "the restaurant opens for dinner"]),
    "Value for Money": (["great value for money", "excellent price for what you get", "very reasonable rates", "worth every euro", "good value for the location"],
                        ["overpriced for what it is", "poor value for money", "far too expensive", "not worth the price", "a rip off"],
                        ["the price was average for the city", "we paid the standard rate"]),
    "Check-in/Check-out": (["check in was quick and easy", "smooth check out", "early check in was arranged for us", "check in took two minutes", "late check out was no problem"],
                           ["check in took over an hour", "check out was chaotic", "they refused early check in", "our booking was lost at check in", "a long queue at check in"],
                           ["check in is at three", "check out is at eleven"]),
    "Air Conditioning/Heating": (["the air conditioning worked well", "the heating kept us warm", "great climate control", "aircon was quiet and effective", "the room was nicely cool"],
                                 ["the air conditioning did not work", "the room was freezing and the heating was broken", "the aircon was very loud", "it was boiling hot with no air conditioning", "the heater barely worked"],
                                 ["the room has air conditioning", "heating is controlled centrally"]),
    "Parking": (["parking was easy", "convenient underground parking", "free parking on site", "plenty of parking spaces", "the valet parking was great"],
                ["parking was expensive", "no parking available", "parking was a nightmare", "we had to park far away", "the car park was tiny"],
                ["parking costs extra per day", "there is a public car park nearby"]),
    "Security": (["we felt very safe", "good security with key cards", "the safe in the room was handy", "secure entrance at night", "security staff were present"],
                 ["we did not feel safe", "the door lock was broken", "no security at night", "the room safe did not work", "anyone could walk in from the street"],
                 ["the room had a safe", "key cards are needed for the lift"]),
    "View": (["the view was stunning", "amazing view of the city", "beautiful sea view", "a wonderful view from the balcony", "great views from the terrace"],
             ["the view was of a brick wall", "no view at all", "the window looked onto the bins", "a depressing view of the car park", "the view was blocked by scaffolding"],
             ["the room faced the courtyard", "the window overlooked the street"]),
    "Lobby/Common Areas": (["the lobby was beautiful", "lovely common areas to relax", "the lounge was stylish", "a welcoming lobby", "the bar area was great"],
                           ["the lobby was shabby", "common areas were dirty", "the corridors smelled bad", "the lounge was crowded and noisy", "the lobby looked neglected"],
                           ["the lobby has a small seating area", "the bar is next to the lobby"]),
    "Accessibility": (["very accessible for wheelchair users", "step free access throughout", "the accessible room was well designed", "easy access for elderly guests", "ramps made everything easy"],
                      ["not accessible for wheelchairs", "lots of stairs and no ramp", "the accessible room was not suitable", "difficult access for my elderly mother", "steps everywhere with no lift access"],
                      ["accessible rooms are on the ground floor", "there is a ramp at the side entrance"]),
    "General Experience": (["we had a wonderful stay", "overall an excellent hotel", "would definitely stay again", "a fantastic experience", "highly recommended"],
                           ["the worst hotel experience ever", "overall a disappointing stay", "would never come back", "a terrible experience", "avoid this hotel"],
                           ["we stayed for three nights", "it was our first visit", "we were there for a conference"]),
}
OPENERS = ["", "", "", "honestly ", "overall ", "i must say ", "on the whole ", "to be fair "]
POS_TAILS = ["", "", "!", " and we loved it", ", really impressed"]
NEG_TAILS = ["", "", ".", " which was disappointing", ", very annoying"]
JOINERS = [" and ", ", ", " and also ", "; "]


def main() -> None:
    rng = random.Random(SEED)
    assert list(BANK) == DEFAULT_ASPECTS
    weights = [10, 9, 8, 6, 6, 4, 4, 5, 3, 2, 1.2, 4, 3, 2.5, 1.5, 1.2, 1, 1.5, 1.2, 0.6, 4]
    hotels = [f"Demo Hotel {i:02d}" for i in range(1, 13)]
    rows, seen = [], set()
    while len(rows) < N:
        r = rng.random()
        sentiment = "positive" if r < 0.51 else "negative" if r < 0.965 else "neutral"
        k = rng.choices([1, 2, 3], [0.62, 0.3, 0.08])[0]
        aspects = []
        while len(aspects) < k:
            a = rng.choices(DEFAULT_ASPECTS, weights)[0]
            if a not in aspects:
                aspects.append(a)
        idx = {"positive": 0, "negative": 1, "neutral": 2}[sentiment]
        parts = [rng.choice(BANK[a][idx]) for a in aspects]
        text = rng.choice(OPENERS) + parts[0]
        for p in parts[1:]:
            text += rng.choice(JOINERS) + p
        if sentiment == "positive":
            text += rng.choice(POS_TAILS)
        elif sentiment == "negative":
            text += rng.choice(NEG_TAILS)
        text = text[0].upper() + text[1:]
        if text in seen:
            continue
        seen.add(text)
        rows.append({"hotel": rng.choice(hotels), "sentence": text, "sentiment": sentiment.title(),
                     **{a: int(a in aspects) for a in DEFAULT_ASPECTS}})
    DEMO_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DEMO_FILE, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["hotel", "sentence", "sentiment", *DEFAULT_ASPECTS])
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} SYNTHETIC rows -> {DEMO_FILE}")


if __name__ == "__main__":
    main()
