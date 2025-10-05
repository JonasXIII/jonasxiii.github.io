# analyse.py
import json
import statistics
from collections import defaultdict, Counter

def comprehensive_card_analysis(json_file_path):
    """Comprehensive analysis of Dominion card data"""
    
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    all_cards = []
    set_stats = defaultdict(lambda: {'count': 0, 'cards': []})
    tag_stats = defaultdict(int)
    cost_stats = []
    
    print("=== COMPREHENSIVE DOMINION CARD ANALYSIS ===\n")
    
    # Analyze each set
    for set_id, set_data in data.items():
        set_name = set_data.get('name', set_id)
        cards = set_data.get('cards', [])
        
        print(f"📦 Set: {set_name} ({set_id})")
        print(f"   Cards: {len(cards)}")
        
        if cards:
            # Cost analysis
            costs = [card.get('cost', {}).get('treasure', 0) for card in cards]
            potion_cards = [card for card in cards if card.get('cost', {}).get('potion', 0) > 0]
            
            print(f"   Average cost: {statistics.mean(costs):.1f}")
            print(f"   Cost range: {min(costs)} - {max(costs)}")
            print(f"   Potion cards: {len(potion_cards)}")
            
            # Tag analysis
            for card in cards:
                all_cards.append(card)
                set_stats[set_id]['count'] += 1
                set_stats[set_id]['cards'].append(card['name'])
                
                # Count all boolean tags
                for key, value in card.items():
                    if isinstance(value, bool) and value:
                        tag_stats[key] += 1
        
        print()
    
    # Overall statistics
    print("=== OVERALL STATISTICS ===")
    print(f"Total sets: {len(data)}")
    print(f"Total cards: {len(all_cards)}")
    
    # Cost distribution
    all_costs = [card.get('cost', {}).get('treasure', 0) for card in all_cards]
    print(f"\n💰 Cost Analysis:")
    print(f"   Average cost: {statistics.mean(all_costs):.1f}")
    print(f"   Median cost: {statistics.median(all_costs)}")
    print(f"   Cost distribution: {dict(Counter(all_costs))}")
    
    # Tag frequency
    print(f"\n🏷️  Most Common Tags:")
    for tag, count in sorted(tag_stats.items(), key=lambda x: x[1], reverse=True)[:15]:
        percentage = (count / len(all_cards)) * 100
        print(f"   {tag}: {count} cards ({percentage:.1f}%)")
    
    # Card type combinations
    print(f"\n🔗 Common Card Type Combinations:")
    type_combinations = defaultdict(int)
    
    for card in all_cards:
        types = []
        if card.get('isAction'): types.append('Action')
        if card.get('isTreasure'): types.append('Treasure')
        if card.get('isVictory'): types.append('Victory')
        if card.get('isAttack'): types.append('Attack')
        if card.get('isReaction'): types.append('Reaction')
        if card.get('isDuration'): types.append('Duration')
        
        if types:
            type_key = '+'.join(sorted(types))
            type_combinations[type_key] += 1
    
    for combo, count in sorted(type_combinations.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"   {combo}: {count} cards")
    
    return all_cards, set_stats, tag_stats

def generate_advanced_filters(tag_stats):
    """Generate advanced JavaScript filter functions"""
    
    print(f"\n=== ADVANCED JAVASCRIPT FILTERS ===")
    
    # Basic type filters
    boolean_tags = [tag for tag in tag_stats.keys() if tag.startswith('is')]
    
    print("// Basic type filters")
    for tag in boolean_tags:
        function_name = tag.replace('is', '').lower()
        print(f"const {function_name} = card => card.{tag} === true;")
    
    # Combined filters
    print("\n// Combined filters")
    print("const isActionVillage = card => card.isAction && card.isActionSupplier;")
    print("const isAttackReaction = card => card.isAttack && card.isReaction;")
    print("const isTreasureVictory = card => card.isTreasure && card.isVictory;")
    
    # Cost filters
    print("\n// Cost filters")
    print("const costBetween = (min, max) => card => {")
    print("  const cost = card.cost?.treasure || 0;")
    print("  return cost >= min && cost <= max;")
    print("};")
    print("const hasPotionCost = card => card.cost?.potion > 0;")
    print("const costExactly = (amount) => card => card.cost?.treasure === amount;")
    
    # Set filters
    print("\n// Set filters")
    print("const fromSet = (setId) => card => card.setId === setId;")
    print("const fromSets = (setIds) => card => setIds.includes(card.setId);")

def check_data_quality(all_cards):
    """Check for data quality issues"""
    
    print(f"\n=== DATA QUALITY CHECK ===")
    
    issues = []
    
    # Check for missing required fields
    for card in all_cards:
        if not card.get('name'):
            issues.append(f"Card missing name: {card.get('id', 'Unknown ID')}")
        if 'cost' not in card:
            issues.append(f"Card missing cost: {card.get('name', 'Unknown')}")
        if not card.get('setId'):
            issues.append(f"Card missing setId: {card.get('name', 'Unknown')}")
    
    if issues:
        print(f"❌ Found {len(issues)} data quality issues:")
        for issue in issues[:10]:  # Show first 10 issues
            print(f"   {issue}")
        if len(issues) > 10:
            print(f"   ... and {len(issues) - 10} more issues")
    else:
        print("✅ No data quality issues found!")
    
    return issues

if __name__ == "__main__":
    json_file_path = "dominion_randomizer/data/dominion_cards.json"
    
    try:
        all_cards, set_stats, tag_stats = comprehensive_card_analysis(json_file_path)
        generate_advanced_filters(tag_stats)
        check_data_quality(all_cards)
        
        # Generate set selection recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        print("1. Start with base sets for balanced gameplay")
        print("2. Add expansions gradually for complexity")
        print("3. Use cost spreading for varied gameplay")
        print("4. Consider including at least one village and one trashing card")
        
    except FileNotFoundError:
        print(f"Error: Could not find {json_file_path}")
    except json.JSONDecodeError:
        print("Error: Invalid JSON file")
    except Exception as e:
        print(f"Unexpected error: {e}")