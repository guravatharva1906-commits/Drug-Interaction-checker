from flask import Flask, render_template, request, jsonify
import csv
import os
from itertools import combinations

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
INTERACTIONS_FILE = os.path.join(BASE_DIR, 'data', 'interactions.csv')
ALTERNATIVES_FILE = os.path.join(BASE_DIR, 'data', 'alternatives.csv')


def load_interactions():
    interactions = {}
    with open(INTERACTIONS_FILE, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            d1 = row['drug1'].strip().lower()
            d2 = row['drug2'].strip().lower()
            key = tuple(sorted([d1, d2]))
            interactions[key] = {
                'drug1': row['drug1'].strip(),
                'drug2': row['drug2'].strip(),
                'severity': row['severity'].strip(),
                'description': row['description'].strip(),
                'mechanism': row['mechanism'].strip(),
            }
    return interactions


def load_alternatives():
    alternatives = {}
    with open(ALTERNATIVES_FILE, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row['drug'].strip().lower()
            alternatives[name] = {
                'category': row['category'].strip(),
                'alternatives': [a.strip() for a in row['alternatives'].split(',')]
            }
    return alternatives


def get_all_drugs():
    drugs = set()
    with open(INTERACTIONS_FILE, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            drugs.add(row['drug1'].strip())
            drugs.add(row['drug2'].strip())
    return sorted(drugs)


@app.route('/')
def index():
    drugs = get_all_drugs()
    return render_template('index.html', drugs=drugs)


@app.route('/check', methods=['POST'])
def check_interactions():
    data = request.get_json()
    selected_drugs = data.get('drugs', [])

    if len(selected_drugs) < 2:
        return jsonify({'error': 'Please select at least 2 drugs.'}), 400

    interactions = load_interactions()
    alternatives = load_alternatives()

    results = []
    highest_severity = 'safe'
    severity_order = {'safe': 0, 'caution': 1, 'dangerous': 2}

    for d1, d2 in combinations(selected_drugs, 2):
        key = tuple(sorted([d1.lower(), d2.lower()]))
        if key in interactions:
            interaction = interactions[key]
            results.append(interaction)
            if severity_order.get(interaction['severity'], 0) > severity_order.get(highest_severity, 0):
                highest_severity = interaction['severity']

    # Suggest alternatives for drugs involved in dangerous/caution interactions
    involved_drugs = set()
    for r in results:
        if r['severity'] in ('dangerous', 'caution'):
            involved_drugs.add(r['drug1'].lower())
            involved_drugs.add(r['drug2'].lower())

    alt_suggestions = {}
    for drug in involved_drugs:
        if drug in alternatives:
            alt_suggestions[drug] = alternatives[drug]

    overall = 'safe' if not results else highest_severity

    return jsonify({
        'interactions': results,
        'overall': overall,
        'alternatives': alt_suggestions,
        'total_checked': len(list(combinations(selected_drugs, 2))),
        'issues_found': len(results)
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
